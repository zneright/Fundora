/**
 * Fundora — Identity & Jurisdiction Normalization Utilities
 * Preserves the exact field normalization, R.A. 10742 age bracket routing,
 * and SHA-256 document hashing rules specified in FD-SDLC-08.
 */

export function normalizePersonName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function normalizeBarangayName(raw: string): string {
  return raw
    .trim()
    .replace(/^(barangay|brgy\.?)\s+/i, '')
    .replace(/\s+/g, ' ');
}

export function normalizePhonePh(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('639') && digits.length === 12) {
    return `0${digits.slice(2)}`;
  }
  if (digits.startsWith('9') && digits.length === 10) {
    return `0${digits}`;
  }
  return digits;
}

export function isValidPhMobile(raw: string): boolean {
  const normalized = normalizePhonePh(raw);
  return /^09\d{9}$/.test(normalized);
}

export type SkSubRole =
  | 'elected_chairperson'
  | 'elected_kagawad'
  | 'appointed_secretary'
  | 'appointed_treasurer';

/**
 * Calculates exact age in years as of a reference date and applies R.A. 10742
 * (as amended by R.A. 11768) Sangguniang Kabataan Reform Act age-bracket routing:
 * - `< 15`: `under_15_blocked` (Blocked from registration)
 * - `15 - 30`: `eligible_youth` (Full Katipunan ng Kabataan voting membership)
 * - `> 30`: `over_30_viewer` (Auto-provisioned as Public Transparency Viewer for residents;
 *   allowed for Barangay Admin / Official oversight roles)
 *
 * For SK Officials:
 * - Elected (Chairperson, Kagawad): 18–24 years old on election day
 * - Appointed (Secretary, Treasurer): 18–30 years old on appointment day
 * - Minors (15–17): Ineligible for SK office (allowed only as resident voter)
 */
export function evaluateRa10742AgeEligibility(
  birthDateIso: string,
  requestedRole: 'resident' | 'sk_official' | 'barangay_admin',
  referenceDate: Date = new Date(),
  skSubRole?: SkSubRole | string
): {
  ageYears: number;
  ageBracketStatus: 'eligible_youth' | 'over_30_viewer' | 'under_15_blocked' | 'ineligible_sk_age';
  effectiveRole: 'resident' | 'sk_official' | 'barangay_admin' | 'viewer';
  allowed: boolean;
  noticeMessage?: string;
} {
  const birth = new Date(birthDateIso);
  if (Number.isNaN(birth.getTime())) {
    return {
      ageYears: 0,
      ageBracketStatus: 'under_15_blocked',
      effectiveRole: requestedRole,
      allowed: false,
      noticeMessage: 'Please enter a valid date of birth.',
    };
  }

  let age = referenceDate.getFullYear() - birth.getFullYear();
  const monthDiff = referenceDate.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < birth.getDate())) {
    age -= 1;
  }

  if (age < 15) {
    return {
      ageYears: age,
      ageBracketStatus: 'under_15_blocked',
      effectiveRole: requestedRole,
      allowed: false,
      noticeMessage:
        'Under R.A. 10742 (SK Reform Act), civic treasury participants must be at least 15 years old.',
    };
  }

  if (requestedRole === 'barangay_admin') {
    if (age < 18) {
      return {
        ageYears: age,
        ageBracketStatus: 'ineligible_sk_age',
        effectiveRole: 'barangay_admin',
        allowed: false,
        noticeMessage: 'Barangay Administrators must be at least 18 years of age.',
      };
    }
    return {
      ageYears: age,
      ageBracketStatus: age > 30 ? 'over_30_viewer' : 'eligible_youth',
      effectiveRole: 'barangay_admin',
      allowed: true,
      noticeMessage:
        age > 30
          ? 'Barangay Admin jurisdiction oversight verified (senior LGU official bracket).'
          : 'Barangay Admin jurisdiction oversight verified.',
    };
  }

  if (requestedRole === 'sk_official') {
    if (age < 18) {
      return {
        ageYears: age,
        ageBracketStatus: 'ineligible_sk_age',
        effectiveRole: 'resident',
        allowed: false,
        noticeMessage:
          'Under R.A. 10742 as amended by R.A. 11768, Sangguniang Kabataan officials must be at least 18 years old on assumption/election day. Minors aged 15–17 may participate as KK Youth voters.',
      };
    }

    if (age > 30) {
      return {
        ageYears: age,
        ageBracketStatus: 'over_30_viewer',
        effectiveRole: 'viewer',
        allowed: false,
        noticeMessage:
          'Under R.A. 10742 Section 10 as amended by R.A. 11768, Sangguniang Kabataan (SK) Officials must be between 18 and 30 years of age.',
      };
    }

    if (skSubRole === 'elected_chairperson' || skSubRole === 'elected_kagawad') {
      if (age > 24) {
        return {
          ageYears: age,
          ageBracketStatus: 'ineligible_sk_age',
          effectiveRole: 'viewer',
          allowed: false,
          noticeMessage:
            'Under R.A. 10742 Section 10 as amended by R.A. 11768, elected SK Officials (Chairperson and Kagawad) must be between 18 and 24 years old on election day. Appointed officials (Secretary and Treasurer) may be up to 30 years old.',
        };
      }
      return {
        ageYears: age,
        ageBracketStatus: 'eligible_youth',
        effectiveRole: 'sk_official',
        allowed: true,
        noticeMessage: 'Eligible for elected SK office (ages 18–24).',
      };
    }

    if (skSubRole === 'appointed_secretary' || skSubRole === 'appointed_treasurer') {
      return {
        ageYears: age,
        ageBracketStatus: 'eligible_youth',
        effectiveRole: 'sk_official',
        allowed: true,
        noticeMessage: 'Eligible for appointed SK office (ages 18–30).',
      };
    }

    // Default if no sub-role specified yet
    if (age > 24) {
      return {
        ageYears: age,
        ageBracketStatus: 'eligible_youth',
        effectiveRole: 'sk_official',
        allowed: true,
        noticeMessage:
          'Eligible for appointed SK positions (Secretary/Treasurer, ages 18–30). Elected positions (Chairperson/Kagawad) require ages 18–24.',
      };
    }

    return {
      ageYears: age,
      ageBracketStatus: 'eligible_youth',
      effectiveRole: 'sk_official',
      allowed: true,
    };
  }

  // Resident
  if (age > 30) {
    return {
      ageYears: age,
      ageBracketStatus: 'over_30_viewer',
      effectiveRole: 'viewer',
      allowed: true,
      noticeMessage:
        'Under R.A. 10742, Katipunan ng Kabataan voting membership is for ages 15–30. Your account will be provisioned as a verified Public Transparency Viewer with full ledger inspection rights.',
    };
  }

  return {
    ageYears: age,
    ageBracketStatus: 'eligible_youth',
    effectiveRole: 'resident',
    allowed: true,
  };
}

/**
 * Computes a deterministic hex hash (SHA-256 via Web Crypto when available,
 * with a deterministic FNV-1a 256-bit fallback for synchronous or test environments).
 */
export async function computeSha256Hex(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(input);
      const digest = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      // Fallback below
    }
  }
  return computeDeterministicHashSync(input);
}

export function computeDeterministicHashSync(input: string): string {
  const seeds = [
    0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35,
    0x27d4eb2f, 0x165667b1, 0xd3a2646c, 0xfd7046c5,
  ];
  const out = seeds.map((seed, idx) => {
    let h = seed ^ idx;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  });
  return out.join('');
}

/**
 * Computes Levenshtein edit distance for OCR typo detection
 */
export function levenshteinDistance(a: string, b: string): number {
  const s = a.toLowerCase().trim();
  const t = b.toLowerCase().trim();
  if (s === t) return 0;
  if (s.length === 0) return t.length;
  if (t.length === 0) return s.length;

  const dp: number[][] = Array.from({ length: s.length + 1 }, () =>
    new Array(t.length + 1).fill(0)
  );
  for (let i = 0; i <= s.length; i++) dp[i][0] = i;
  for (let j = 0; j <= t.length; j++) dp[0][j] = j;

  for (let i = 1; i <= s.length; i++) {
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[s.length][t.length];
}
