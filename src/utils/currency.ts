/**
 * Fundora — NEAR & Philippine Peso (PHP) Currency Formatting Utilities
 * 1 NEAR = 10^24 yoctoNEAR.
 */

import { APP_CONFIG } from '../configuration/config';

const YOCTO_PER_NEAR = 10n ** 24n;

export function nearToYocto(nearAmount: string | number): string {
  const clean = String(nearAmount).trim();
  if (!clean || Number.isNaN(Number(clean))) return '0';
  const [wholePart = '0', fracPart = ''] = clean.split('.');
  const paddedFrac = (fracPart + '0'.repeat(24)).slice(0, 24);
  const total = BigInt(wholePart) * YOCTO_PER_NEAR + BigInt(paddedFrac);
  return total.toString();
}

export function yoctoToNear(yoctoAmount: string | bigint, decimals = 2): string {
  try {
    const raw = typeof yoctoAmount === 'bigint' ? yoctoAmount : BigInt(yoctoAmount || '0');
    const whole = raw / YOCTO_PER_NEAR;
    const remainder = raw % YOCTO_PER_NEAR;
    if (decimals <= 0) return whole.toString();
    const fracStr = remainder.toString().padStart(24, '0').slice(0, decimals);
    return `${whole.toString()}.${fracStr}`;
  } catch {
    return '0.00';
  }
}

export function formatPhp(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export function formatNear(nearAmount: string | number): string {
  const num = Number(nearAmount || 0);
  return `${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })} NEAR`;
}

export function phpToNear(phpAmount: number, rate = APP_CONFIG.near.phpPerNearRate): string {
  if (!rate || rate <= 0) return '0.00';
  return (phpAmount / rate).toFixed(4);
}
