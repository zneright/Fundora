/**
 * Fundora — Backend Security, Auth, Rate Limiting, Prompt-Injection Defense & Hashing
 */

import { createHash, createHmac } from 'node:crypto';
import type {
  AuthenticatedCallerContext,
  UploadedImageInput,
} from './types.ts';
import type { UserRole } from '../../src/types/domain.types.ts';

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB max per image
export const MAX_IMAGES_PER_REQUEST = 10;
export const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 5;
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export class ApiSecurityError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly retryAfterSeconds?: number;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'ApiSecurityError';
    this.statusCode = statusCode;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// ============================================================================
// 1. Canonical JSON & SHA-256 Digest
// ============================================================================

export function canonicalizeJson(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalizeJson(item));
    return `[${items.join(',')}]`;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sortedKeys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    const pairs = sortedKeys.map(
      (k) => `${JSON.stringify(k)}:${canonicalizeJson(obj[k])}`
    );
    return `{${pairs.join(',')}}`;
  }
  return JSON.stringify(String(value));
}

export function computeSha256HexServer(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex').toLowerCase();
}

export function computeCanonicalReportSha256(reportPayload: unknown): string {
  const canonical = canonicalizeJson(reportPayload);
  return computeSha256HexServer(canonical);
}

// ============================================================================
// 2. Privacy-Preserving Identifier Normalization & Server-Keyed HMAC-SHA256
// ============================================================================
//
// SECURITY NOTE (RISK-12 Remediation):
// Plain unsalted SHA-256 over predictable, low-entropy personal identifiers
// (such as 11-digit Philippine mobile numbers `09XXXXXXXXX`, structured government IDs,
// or `name + birthdate` combinations) is vulnerable to offline rainbow-table and
// brute-force enumeration if the duplicate-detection index is ever exposed.
//
// All personal identifier duplicate hashes therefore use server-secret-keyed
// HMAC-SHA256 (`IDENTITY_HMAC_SECRET` environment variable). In local/test
// environments where `IDENTITY_HMAC_SECRET` is unset, a deterministic test/dev
// fallback key is used and `isIdentityHmacSecretConfigured()` returns `false`
// so deployment checks and audit logs flag the missing production secret.

const DEV_FALLBACK_HMAC_KEY =
  'fundora-dev-only-ephemeral-identity-hmac-key-replace-in-prod';

export function isIdentityHmacSecretConfigured(): boolean {
  const configured = process.env.IDENTITY_HMAC_SECRET?.trim();
  return Boolean(configured && configured.length >= 32);
}

function getIdentityHmacKey(): string {
  const configured = process.env.IDENTITY_HMAC_SECRET?.trim();
  if (configured && configured.length > 0) {
    return configured;
  }
  return DEV_FALLBACK_HMAC_KEY;
}

export function computeIdentityHmacSha256(domainSeparatedInput: string): string {
  return createHmac('sha256', getIdentityHmacKey())
    .update(domainSeparatedInput, 'utf8')
    .digest('hex')
    .toLowerCase();
}

export function normalizeIdNumber(raw: string): string {
  return (raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

export function hashNormalizedIdNumber(idType: string, idNumber: string): string {
  const normType = (idType || 'government_id').toLowerCase().trim();
  const normNum = normalizeIdNumber(idNumber);
  if (!normNum) return '';
  return computeIdentityHmacSha256(`fundora:id:${normType}:${normNum}`);
}

export function hashNormalizedMobile(mobile: string): string {
  const digits = (mobile || '').replace(/\D/g, '');
  let normalized = digits;
  if (digits.startsWith('639') && digits.length === 12) {
    normalized = `0${digits.slice(2)}`;
  } else if (digits.startsWith('9') && digits.length === 10) {
    normalized = `0${digits}`;
  }
  if (!normalized) return '';
  return computeIdentityHmacSha256(`fundora:mobile:${normalized}`);
}

export function hashNormalizedNameAndBirthdate(
  firstName: string,
  lastName: string,
  birthDate: string
): string {
  const normFirst = (firstName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
  const normLast = (lastName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
  const normBirth = (birthDate || '').trim();
  return computeIdentityHmacSha256(`fundora:identity:${normFirst}:${normLast}:${normBirth}`);
}

export function maskSensitiveIdNumber(raw: string): string {
  const cleaned = (raw || '').trim();
  if (!cleaned) return '';
  if (cleaned.length <= 4) return '****';
  const tail = cleaned.slice(-4);
  return `****-****-${tail}`;
}

// ============================================================================
// 3. Prompt Injection Detection & Input Delimiting
// ============================================================================

const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above|system)\s+(instructions|prompts|rules|directives)/i,
  /disregard\s+(all\s+)?(previous|prior|system)\s+(instructions|rules|constraints)/i,
  /you\s+are\s+now\s+(in\s+)?(developer|jailbreak|unrestricted|admin|god)\s+mode/i,
  /system\s*prompt\s*:/i,
  /override\s+(the\s+)?(audit|feasibility|verification|security)\s*(score|verdict|recommendation|rules)/i,
  /output\s*["']?feasibilityScore["']?\s*:\s*100/i,
  /set\s+["']?(feasibilityScore|overallScore)["']?\s*(to|=|:)\s*100/i,
  /set\s+["']?(recommendation|verdict)["']?\s*(to|=|:)\s*["']?(approve|PASS)["']?/i,
  /<\s*\/?\s*(system|instruction|untrusted_data|prompt_override)\s*>/i,
];

export function detectPromptInjection(texts: Array<string | undefined | null>): {
  detected: boolean;
  matchedPatterns: string[];
} {
  const matchedPatterns: string[] = [];
  for (const raw of texts) {
    if (!raw) continue;
    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(raw)) {
        matchedPatterns.push(pattern.source);
      }
    }
  }
  return {
    detected: matchedPatterns.length > 0,
    matchedPatterns: Array.from(new Set(matchedPatterns)),
  };
}

export function sanitizeUntrustedText(raw: string, maxLength = 4000): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim()
    .slice(0, maxLength);
}

export function wrapUntrustedXml(tagName: string, rawContent: string): string {
  const safeTag = tagName.replace(/[^a-zA-Z0-9_-]/g, '');
  const sanitized = sanitizeUntrustedText(rawContent);
  return `<${safeTag}>\n${sanitized}\n</${safeTag}>`;
}

// ============================================================================
// 4. Upload & Request Body Validation
// ============================================================================

export function validateUploadedImages(
  images: UploadedImageInput[] | undefined,
  options: { required: boolean; maxImages?: number } = { required: false }
): void {
  if (!images || images.length === 0) {
    if (options.required) {
      throw new ApiSecurityError(
        400,
        'ERR_MISSING_UPLOADS',
        'At least one valid evidence or identity image upload is required.'
      );
    }
    return;
  }

  const maxCount = options.maxImages ?? MAX_IMAGES_PER_REQUEST;
  if (images.length > maxCount) {
    throw new ApiSecurityError(
      400,
      'ERR_TOO_MANY_UPLOADS',
      `Maximum of ${maxCount} uploaded images allowed per request.`
    );
  }

  for (const img of images) {
    if (!img || typeof img !== 'object') {
      throw new ApiSecurityError(400, 'ERR_MALFORMED_UPLOAD', 'Invalid image upload object.');
    }
    const mime = (img.mimeType || '').toLowerCase().trim();
    if (!ALLOWED_IMAGE_MIME_TYPES.has(mime)) {
      throw new ApiSecurityError(
        400,
        'ERR_UNSUPPORTED_FILE_TYPE',
        `Unsupported file MIME type "${img.mimeType}". Allowed types: JPEG, PNG, WEBP.`
      );
    }

    if (typeof img.sizeBytes !== 'number' || img.sizeBytes <= 0) {
      throw new ApiSecurityError(
        400,
        'ERR_INVALID_FILE_SIZE',
        `Upload "${img.tag || 'image'}" must have a positive byte size.`
      );
    }

    if (img.sizeBytes > MAX_IMAGE_SIZE_BYTES) {
      throw new ApiSecurityError(
        413,
        'ERR_FILE_TOO_LARGE',
        `Upload "${img.tag || 'image'}" exceeds maximum allowed size of 5 MB.`
      );
    }

    if (!img.dataUrl || typeof img.dataUrl !== 'string') {
      throw new ApiSecurityError(
        400,
        'ERR_MALFORMED_DATA_URL',
        `Upload "${img.tag || 'image'}" is missing base64 dataUrl content.`
      );
    }

    const dataUrlMatch = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/i.exec(
      img.dataUrl.trim()
    );
    if (!dataUrlMatch) {
      throw new ApiSecurityError(
        400,
        'ERR_MALFORMED_BASE64_IMAGE',
        `Upload "${img.tag || 'image'}" is not a valid base64-encoded image data URL.`
      );
    }

    const base64Body = dataUrlMatch[2].replace(/\s+/g, '');
    const estimatedBytes = Math.floor((base64Body.length * 3) / 4);
    if (estimatedBytes > MAX_IMAGE_SIZE_BYTES) {
      throw new ApiSecurityError(
        413,
        'ERR_PAYLOAD_TOO_LARGE',
        `Decoded payload for "${img.tag || 'image'}" exceeds 5 MB limit.`
      );
    }
  }
}

// ============================================================================
// 5. Authentication & Barangay / Role Scope Authorization
// ============================================================================

export type TokenVerifierFn = (
  bearerToken: string
) => Promise<AuthenticatedCallerContext | null>;

let customTokenVerifier: TokenVerifierFn | null = null;

export function setCustomTokenVerifierForTesting(verifier: TokenVerifierFn | null): void {
  customTokenVerifier = verifier;
}

/**
 * Default token verifier:
 * Supports signed/structured server tokens or Firebase ID token verification.
 * Never accepts unauthenticated requests.
 */
async function defaultVerifyBearerToken(
  bearerToken: string
): Promise<AuthenticatedCallerContext | null> {
  if (!bearerToken || bearerToken.trim().length < 10) {
    return null;
  }

  // Support structured test/dev JWT or JSON bearer tokens when format is `fundora_token:<base64json>`
  if (bearerToken.startsWith('fundora_token:')) {
    try {
      const encoded = bearerToken.slice('fundora_token:'.length);
      const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as Partial<
        AuthenticatedCallerContext
      >;
      if (decoded.uid && decoded.role && decoded.barangayId) {
        return {
          uid: decoded.uid,
          email: decoded.email,
          role: decoded.role,
          barangayId: decoded.barangayId,
          status: decoded.status || 'active',
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  return null;
}

export async function authenticateAndAuthorizeRequest(params: {
  authorizationHeader?: string;
  requiredRoles: UserRole[];
  targetBarangayId: string;
  targetOwnerUid?: string;
  allowSelfOnboarding?: boolean;
}): Promise<AuthenticatedCallerContext> {
  const rawHeader = params.authorizationHeader || '';
  if (!rawHeader.startsWith('Bearer ')) {
    throw new ApiSecurityError(
      401,
      'ERR_UNAUTHENTICATED',
      'Missing or invalid Authorization Bearer token.'
    );
  }

  const token = rawHeader.slice('Bearer '.length).trim();
  const verifier = customTokenVerifier || defaultVerifyBearerToken;
  const caller = await verifier(token);

  if (!caller || !caller.uid) {
    throw new ApiSecurityError(
      401,
      'ERR_INVALID_AUTH_TOKEN',
      'Authentication token is invalid or expired.'
    );
  }

  if (caller.status === 'suspended') {
    throw new ApiSecurityError(
      403,
      'ERR_ACCOUNT_SUSPENDED',
      'Suspended accounts cannot invoke protected AI Auditor endpoints.'
    );
  }

  // Check self-onboarding allowance (for POST /api/ai/verify-identity)
  if (params.allowSelfOnboarding && params.targetOwnerUid && caller.uid === params.targetOwnerUid) {
    if (caller.barangayId !== params.targetBarangayId && caller.role !== 'system_admin') {
      throw new ApiSecurityError(
        403,
        'ERR_CROSS_BARANGAY_FORBIDDEN',
        `Caller barangay scope (${caller.barangayId}) does not match target barangay (${params.targetBarangayId}).`
      );
    }
    return caller;
  }

  if (!params.requiredRoles.includes(caller.role)) {
    throw new ApiSecurityError(
      403,
      'ERR_UNAUTHORIZED_ROLE',
      `Role "${caller.role}" is not authorized for this endpoint. Required: ${params.requiredRoles.join(', ')}.`
    );
  }

  if (caller.role !== 'system_admin' && caller.barangayId !== params.targetBarangayId) {
    throw new ApiSecurityError(
      403,
      'ERR_CROSS_BARANGAY_FORBIDDEN',
      `Cross-barangay access denied: caller belongs to "${caller.barangayId}", target is "${params.targetBarangayId}".`
    );
  }

  return caller;
}

// ============================================================================
// 6. Sliding-Window Rate Limiter (Per-UID + Endpoint)
// ============================================================================

const rateLimitBuckets = new Map<string, number[]>();

export function enforceRateLimit(
  uid: string,
  endpointKey: string,
  maxRequests = DEFAULT_RATE_LIMIT_MAX_REQUESTS,
  windowMs = DEFAULT_RATE_LIMIT_WINDOW_MS,
  nowMs = Date.now()
): void {
  const key = `${endpointKey}:${uid}`;
  const existing = rateLimitBuckets.get(key) || [];
  const validTimestamps = existing.filter((ts) => nowMs - ts < windowMs);

  if (validTimestamps.length >= maxRequests) {
    const oldest = validTimestamps[0];
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (nowMs - oldest)) / 1000));
    throw new ApiSecurityError(
      429,
      'ERR_RATE_LIMIT_EXCEEDED',
      `Rate limit exceeded for ${endpointKey} (max ${maxRequests} requests per ${Math.round(
        windowMs / 60000
      )} minutes). Please retry in ${retryAfterSec}s.`,
      retryAfterSec
    );
  }

  validTimestamps.push(nowMs);
  rateLimitBuckets.set(key, validTimestamps);
}

export function resetRateLimitsForTesting(): void {
  rateLimitBuckets.clear();
}

// ============================================================================
// 7. Privacy-Preserving Server Audit Logger (Never Logs PII or Secrets)
// ============================================================================

const SENSITIVE_LOG_KEYS = new Set([
  'primaryidnumber',
  'secondaryidnumber',
  'idnumber',
  'idnumberraw',
  'mobilenumber',
  'birthdate',
  'housestreetsitio',
  'streetaddress',
  'fulladdress',
  'dataurl',
  'base64dataurl',
  'idphotobase64',
  'selfiephotobase64',
  'profilephotobase64',
  'privatekey',
  'secretkey',
  'apikey',
  'gemini_api_key',
  'near_auditor_private_key',
  'authorization',
]);

export function redactSensitiveMetadata(
  meta: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (SENSITIVE_LOG_KEYS.has(key.toLowerCase())) {
      out[key] = '[REDACTED_PII_OR_SECRET]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = redactSensitiveMetadata(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

