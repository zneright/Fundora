/**
 * Fundora — Structured Client Logger
 * Ensures sensitive fields (passwords, keys, raw tokens) are redacted.
 */

const REDACTED_KEYS = new Set([
  'password',
  'privateKey',
  'secretKey',
  'inAppWalletSecret',
  'dataUrl',
]);

function sanitizeMeta(meta?: unknown): unknown {
  if (!meta || typeof meta !== 'object') return meta;
  if (Array.isArray(meta)) return meta.map(sanitizeMeta);
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(key)) {
      copy[key] = '[REDACTED]';
    } else {
      copy[key] = sanitizeMeta(value);
    }
  }
  return copy;
}

export const logger = {
  info(context: string, message: string, meta?: unknown): void {
    if (import.meta.env.MODE === 'test') return;
    console.info(`[Fundora:${context}] ${message}`, meta ? sanitizeMeta(meta) : '');
  },
  warn(context: string, message: string, meta?: unknown): void {
    if (import.meta.env.MODE === 'test') return;
    console.warn(`[Fundora:${context}] ${message}`, meta ? sanitizeMeta(meta) : '');
  },
  error(context: string, message: string, meta?: unknown): void {
    if (import.meta.env.MODE === 'test') return;
    console.error(`[Fundora:${context}] ${message}`, meta ? sanitizeMeta(meta) : '');
  },
};
