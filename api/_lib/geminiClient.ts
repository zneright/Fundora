/**
 * Fundora — Server-Only Gemini 2.5 Flash Client & Schema Validator
 * Uses `process.env.GEMINI_API_KEY` exclusively on the backend.
 * Enforces strict timeout, JSON schema validation, and explicit fallback signaling.
 */

export const GEMINI_MODEL_ID = process.env.GEMINI_MODEL_ID || 'gemini-2.5-flash-lite';
export const DEFAULT_GEMINI_TIMEOUT_MS = 10_000;

export interface GeminiCallRequest {
  systemInstruction: string;
  userPrompt: string;
  inlineImages?: Array<{ mimeType: string; base64Data: string }>;
  timeoutMs?: number;
}

export interface GeminiCallResult<T> {
  ok: boolean;
  data?: T;
  fallbackReason?: string;
}

export type GeminiTransportFn = (
  request: GeminiCallRequest,
  apiKey: string
) => Promise<{ status: number; rawText?: string; errorMessage?: string }>;

let customGeminiTransport: GeminiTransportFn | null = null;

export function setCustomGeminiTransportForTesting(
  transport: GeminiTransportFn | null
): void {
  customGeminiTransport = transport;
}

async function defaultHttpGeminiTransport(
  request: GeminiCallRequest,
  apiKey: string
): Promise<{ status: number; rawText?: string; errorMessage?: string }> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_ID}:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;

  const parts: Array<Record<string, unknown>> = [{ text: request.userPrompt }];
  if (request.inlineImages && request.inlineImages.length > 0) {
    for (const img of request.inlineImages) {
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.base64Data,
        },
      });
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    request.timeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS
  );

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: request.systemInstruction }],
        },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      }),
    });

    if (!response.ok) {
      return {
        status: response.status,
        errorMessage: `Gemini API returned HTTP ${response.status}`,
      };
    }

    const body = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const rawText = body?.candidates?.[0]?.content?.parts?.[0]?.text;
    return {
      status: 200,
      rawText,
    };
  } catch (err: unknown) {
    const isAbort =
      err instanceof Error &&
      (err.name === 'AbortError' || err.message.toLowerCase().includes('abort'));
    return {
      status: isAbort ? 408 : 503,
      errorMessage: isAbort
        ? 'Gemini API request timed out'
        : err instanceof Error
          ? err.message
          : 'Gemini network error',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Executes a structured Gemini 2.5 Flash request and validates the response with `validator`.
 * If `GEMINI_API_KEY` is missing, times out, returns 4xx/5xx, or fails schema validation,
 * returns `{ ok: false, fallbackReason }` so the caller executes deterministic fallback cleanly.
 */
export async function invokeGeminiStructured<T>(
  request: GeminiCallRequest,
  validator: (parsed: unknown) => T | null
): Promise<GeminiCallResult<T>> {
  // Strictly read server-only GEMINI_API_KEY (never VITE_GEMINI_API_KEY)
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return {
      ok: false,
      fallbackReason: 'GEMINI_API_KEY is not configured in server environment; using deterministic heuristic fallback.',
    };
  }

  const transport = customGeminiTransport || defaultHttpGeminiTransport;
  const response = await transport(request, apiKey);

  if (response.status !== 200 || !response.rawText) {
    return {
      ok: false,
      fallbackReason:
        response.errorMessage ||
        `Gemini 2.5 Flash unavailable (HTTP ${response.status}); using deterministic heuristic fallback.`,
    };
  }

  try {
    const parsed = JSON.parse(response.rawText) as unknown;
    const validated = validator(parsed);
    if (!validated) {
      return {
        ok: false,
        fallbackReason:
          'Gemini response failed strict output schema validation; using deterministic heuristic fallback.',
      };
    }
    return {
      ok: true,
      data: validated,
    };
  } catch {
    return {
      ok: false,
      fallbackReason:
        'Gemini returned malformed JSON payload; using deterministic heuristic fallback.',
    };
  }
}

// ============================================================================
// Runtime Schema Validators for Gemini Responses
// ============================================================================

export interface GeminiIdentityRawOutput {
  nameMatchScore: number;
  jurisdictionMatchScore: number;
  documentAuthenticityScore: number;
  residencyConsistencyScore: number;
  ageComplianceScore: number;
  livenessScore: number;
  overallScore: number;
  verdict: 'PASS' | 'REVIEW_REQUIRED' | 'REJECT_RECOMMENDED';
  summary: string;
  flags: string[];
  extractedFirstName?: string;
  extractedLastName?: string;
  extractedBirthDate?: string;
  extractedBarangay?: string;
  imageQualityReadable: boolean;
}

export function validateGeminiIdentityOutput(
  raw: unknown
): GeminiIdentityRawOutput | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const scoreFields = [
    'nameMatchScore',
    'jurisdictionMatchScore',
    'documentAuthenticityScore',
    'residencyConsistencyScore',
    'ageComplianceScore',
    'livenessScore',
    'overallScore',
  ] as const;

  for (const field of scoreFields) {
    const val = obj[field];
    if (typeof val !== 'number' || !Number.isFinite(val) || val < 0 || val > 100) {
      return null;
    }
  }

  const verdict = obj.verdict;
  if (
    verdict !== 'PASS' &&
    verdict !== 'REVIEW_REQUIRED' &&
    verdict !== 'REJECT_RECOMMENDED'
  ) {
    return null;
  }

  if (typeof obj.summary !== 'string' || obj.summary.trim().length === 0) {
    return null;
  }

  if (!Array.isArray(obj.flags)) {
    return null;
  }

  return {
    nameMatchScore: Math.round(obj.nameMatchScore as number),
    jurisdictionMatchScore: Math.round(obj.jurisdictionMatchScore as number),
    documentAuthenticityScore: Math.round(obj.documentAuthenticityScore as number),
    residencyConsistencyScore: Math.round(obj.residencyConsistencyScore as number),
    ageComplianceScore: Math.round(obj.ageComplianceScore as number),
    livenessScore: Math.round(obj.livenessScore as number),
    overallScore: Math.round(obj.overallScore as number),
    verdict,
    summary: (obj.summary as string).trim(),
    flags: (obj.flags as unknown[]).map((f) => String(f)),
    extractedFirstName:
      typeof obj.extractedFirstName === 'string' ? obj.extractedFirstName : undefined,
    extractedLastName:
      typeof obj.extractedLastName === 'string' ? obj.extractedLastName : undefined,
    extractedBirthDate:
      typeof obj.extractedBirthDate === 'string' ? obj.extractedBirthDate : undefined,
    extractedBarangay:
      typeof obj.extractedBarangay === 'string' ? obj.extractedBarangay : undefined,
    imageQualityReadable:
      typeof obj.imageQualityReadable === 'boolean' ? obj.imageQualityReadable : true,
  };
}

export interface GeminiProposalRawOutput {
  feasibilityScore: number;
  recommendation: 'approve' | 'revise' | 'flag_high_risk';
  summaryAnalysis: string;
  riskFlags: string[];
}

export function validateGeminiProposalOutput(
  raw: unknown
): GeminiProposalRawOutput | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  if (
    typeof obj.feasibilityScore !== 'number' ||
    !Number.isFinite(obj.feasibilityScore) ||
    obj.feasibilityScore < 0 ||
    obj.feasibilityScore > 100
  ) {
    return null;
  }

  if (
    obj.recommendation !== 'approve' &&
    obj.recommendation !== 'revise' &&
    obj.recommendation !== 'flag_high_risk'
  ) {
    return null;
  }

  if (typeof obj.summaryAnalysis !== 'string' || obj.summaryAnalysis.trim().length === 0) {
    return null;
  }

  if (!Array.isArray(obj.riskFlags)) {
    return null;
  }

  return {
    feasibilityScore: Math.round(obj.feasibilityScore),
    recommendation: obj.recommendation,
    summaryAnalysis: obj.summaryAnalysis.trim(),
    riskFlags: obj.riskFlags.map((f) => String(f)),
  };
}

export interface GeminiEvidenceRawOutput {
  feasibilityScore: number;
  recommendation: 'approve' | 'revise' | 'flag_high_risk';
  summaryForVoters: string;
  summaryAnalysis: string;
  questionableDocumentationFlags: string[];
}

export function validateGeminiEvidenceOutput(
  raw: unknown
): GeminiEvidenceRawOutput | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  if (
    typeof obj.feasibilityScore !== 'number' ||
    !Number.isFinite(obj.feasibilityScore) ||
    obj.feasibilityScore < 0 ||
    obj.feasibilityScore > 100
  ) {
    return null;
  }

  if (
    obj.recommendation !== 'approve' &&
    obj.recommendation !== 'revise' &&
    obj.recommendation !== 'flag_high_risk'
  ) {
    return null;
  }

  if (typeof obj.summaryForVoters !== 'string' || obj.summaryForVoters.trim().length === 0) {
    return null;
  }

  if (typeof obj.summaryAnalysis !== 'string' || obj.summaryAnalysis.trim().length === 0) {
    return null;
  }

  if (!Array.isArray(obj.questionableDocumentationFlags)) {
    return null;
  }

  return {
    feasibilityScore: Math.round(obj.feasibilityScore),
    recommendation: obj.recommendation,
    summaryForVoters: obj.summaryForVoters.trim(),
    summaryAnalysis: obj.summaryAnalysis.trim(),
    questionableDocumentationFlags: obj.questionableDocumentationFlags.map((f) =>
      String(f)
    ),
  };
}

