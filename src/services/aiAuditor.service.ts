/**
 * Fundora — Client-Side Protected AI Auditor API Caller
 * Sends authenticated requests (`Authorization: Bearer <token>`) to the serverless backend:
 *   - POST /api/ai/verify-identity
 *   - POST /api/ai/audit-proposal
 *   - POST /api/ai/audit-evidence
 *
 * Security Invariant:
 * Strictly zero client-side AI API keys or private keys in browser code.
 */

import type {
  AuditEvidenceRequest,
  AuditEvidenceResponse,
  AuditProposalRequest,
  AuditProposalResponse,
  VerifyIdentityRequest,
  VerifyIdentityResponse,
} from '../../api/_lib/types';

export const aiAuditorClientService = {
  async verifyIdentity(
    request: VerifyIdentityRequest,
    bearerToken: string
  ): Promise<VerifyIdentityResponse> {
    const res = await fetch('/api/ai/verify-identity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearerToken}`,
      },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
      };
      throw new Error(
        errBody.error || `Identity verification failed with HTTP ${res.status}`
      );
    }

    return (await res.json()) as VerifyIdentityResponse;
  },

  async auditProposal(
    request: AuditProposalRequest,
    bearerToken: string
  ): Promise<AuditProposalResponse> {
    const res = await fetch('/api/ai/audit-proposal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearerToken}`,
      },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
      };
      throw new Error(
        errBody.error || `Proposal procurement audit failed with HTTP ${res.status}`
      );
    }

    return (await res.json()) as AuditProposalResponse;
  },

  async auditEvidence(
    request: AuditEvidenceRequest,
    bearerToken: string
  ): Promise<AuditEvidenceResponse> {
    const res = await fetch('/api/ai/audit-evidence', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearerToken}`,
      },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
      };
      throw new Error(
        errBody.error || `Milestone evidence audit failed with HTTP ${res.status}`
      );
    }

    return (await res.json()) as AuditEvidenceResponse;
  },
};
