/**
 * Fundora — Phase 1 Hardened Security, Firestore Rules & Clean-Room Brand Verification
 * Verifies:
 * 1. `firestore.rules` has single canonical `match` blocks, blocks open `users` listing,
 *    bans `inAppWalletSecret`/`privateKey`/`secretKey`, and blocks client writes to
 *    `verification_records` and `ai_audit_records`.
 * 2. `users/{uid}` and `registration_records/{uid}` are strictly separated.
 * 3. `walletRepository` and `dbSetDocument` reject any payload containing secret key fields.
 * 4. Zero occurrences of legacy `"Barangay Bond"` or `inAppWalletSecret` exist in `src/` UI/domain files.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  assertNoForbiddenSecretFields,
  resetLocalCollectionsForTest,
} from '../repositories/db.helper';
import { walletRepository } from '../repositories/wallet.repository';
import { authService } from '../services/auth.service';
import type { RegistrationWizardState } from '../types';

const ROOT_DIR = path.resolve(__dirname, '../..');

describe('Phase 1 — Hardened Firestore Rules & Zero-Secret Enforcement', () => {
  beforeEach(() => {
    resetLocalCollectionsForTest();
  });

  it('verifies firestore.rules has single canonical match blocks and enforces least-privilege access', () => {
    const rulesPath = path.join(ROOT_DIR, 'firestore.rules');
    const rulesContent = fs.readFileSync(rulesPath, 'utf-8');

    // Verify no duplicate match blocks for /users/{userId}
    const userMatches = rulesContent.match(/match\s+\/users\/\{userId\}/g) || [];
    expect(userMatches).toHaveLength(1);

    // Verify explicit ban on legacy secret fields in rules
    expect(rulesContent).toContain('"inAppWalletSecret"');
    expect(rulesContent).toContain('"privateKey"');
    expect(rulesContent).toContain('"secretKey"');

    // Verify client writes are blocked on verification_records and ai_audit_records
    expect(rulesContent).toMatch(
      /match\s+\/verification_records\/\{userId\}[\s\S]*?allow create, delete:\s+if false;/
    );
    expect(rulesContent).toMatch(
      /match\s+\/ai_audit_records\/\{auditId\}[\s\S]*?allow write:\s+if false;/
    );
  });

  it('rejects any attempt to store inAppWalletSecret, privateKey, or secretKey in any repository', async () => {
    expect(() =>
      assertNoForbiddenSecretFields(
        { uid: 'u1', inAppWalletSecret: 'S_SECRET_KEY' },
        'users'
      )
    ).toThrow(/Security Violation/i);

    await expect(
      walletRepository.linkNearAccount({
        id: 'wl_1',
        uid: 'u1',
        barangayId: 'brgy_0421090180',
        nearAccountId: 'juan.testnet',
        networkId: 'testnet',
        walletProviderId: 'meteor-wallet',
        isPrimary: true,
        linkedAt: new Date().toISOString(),
        // @ts-expect-error testing runtime rejection of forbidden field
        privateKey: 'ed25519:secret',
      })
    ).rejects.toThrow(/Security Violation/i);
  });

  it('strictly separates non-sensitive users/{uid} from PII in registration_records/{uid}', async () => {
    const wizard: RegistrationWizardState = {
      email: 'resident.imus@fundora.ph',
      selectedRole: 'resident',
      regionCode: '040000000',
      regionName: 'Region IV-A (CALABARZON)',
      provinceCode: '042100000',
      provinceName: 'Cavite',
      cityMunicipalityCode: '042109000',
      cityMunicipalityName: 'City of Imus',
      barangayCode: '0421090180',
      barangayName: 'Bucandala III',
      barangayId: 'brgy_0421090180',
      zipCode: '4103',
      hallAddress: 'Bucandala III Barangay Hall',
      firstName: 'Carlo',
      middleName: 'Reyes',
      lastName: 'Mendoza',
      suffix: '',
      birthDate: '2003-08-20',
      sex: 'Male',
      civilStatus: 'Single',
      mobileNumber: '09181234567',
      houseStreetSitio: 'Lot 9 Blk 3 Mahogany St.',
      primaryIdType: 'Philippine National ID (PhilSys)',
      primaryIdNumber: 'PSN-1111-2222-3333',
      secondaryIdType: '',
      secondaryIdNumber: '',
      positionTitle: '',
      termStartDate: '2025-11-30',
      termEndDate: '2028-11-30',
      dataPrivacyConsent: true,
      truthfulnessAttestation: true,
      uploadedDocuments: [
        {
          id: 'd1',
          tag: 'Primary ID Front',
          label: 'id.jpg',
          dataUrl: 'data:image/jpeg;base64,UNIQUE_1',
          mimeType: 'image/jpeg',
          sizeBytes: 500,
          sha256Hash: '',
          uploadedAt: '2026-11-07T00:00:00Z',
        },
      ],
    };

    const { profile, registrationRecord } = await authService.completeOnboardingSubmission(
      'uid_carlo',
      wizard
    );

    // Non-sensitive profile has jurisdiction routing fields, but ZERO sensitive PII fields
    expect(profile.psgcCode).toBe('0421090180');
    expect(profile.barangayName).toBe('Bucandala III');
    expect('mobileNumber' in (profile as unknown as Record<string, unknown>)).toBe(false);
    expect('primaryIdNumber' in (profile as unknown as Record<string, unknown>)).toBe(false);
    expect('houseStreetSitio' in (profile as unknown as Record<string, unknown>)).toBe(false);

    // Registration record holds the protected PII
    expect(registrationRecord.mobileNumber).toBe('09181234567');
    expect(registrationRecord.primaryIdNumber).toBe('PSN-1111-2222-3333');
    expect(registrationRecord.houseStreetSitio).toBe('Lot 9 Blk 3 Mahogany St.');
  });

  it('confirms zero occurrences of legacy "Barangay Bond" branding or VITE_GEMINI_API_KEY in src/ application code', () => {
    const srcDir = path.join(ROOT_DIR, 'src');
    const walkFiles = (dir: string): string[] => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'test') {
            files.push(...walkFiles(full));
          }
        } else if (/\.(ts|tsx|css|json)$/.test(entry.name)) {
          files.push(full);
        }
      }
      return files;
    };

    const appFiles = walkFiles(srcDir);
    expect(appFiles.length).toBeGreaterThan(15);

    for (const file of appFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/Barangay Bond/i);
      expect(content).not.toContain('VITE_GEMINI_API_KEY');
    }
  });
});
