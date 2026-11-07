// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransparencyHub, buildSanitizedPublicProjectView } from '../components/TransparencyHub';
import { ReceiptModal } from '../components/ReceiptModal';
import { JudgeDemoToolbar } from '../components/JudgeDemoToolbar';
import { ActivityView } from '../components/ActivityView';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { NearWalletProvider } from '../contexts/NearWalletContext';
import {
  validateReceiptPayload,
  resolveReceiptVerificationMetadata,
  computeReceiptIntegrityHash,
  generateReceiptPdfDocument,
  isSimulatedTxHash,
  type FundoraDigitalReceiptPayload,
} from '../utils/receiptPdfGenerator';
import {
  demoSandboxService,
  DEMO_BARANGAY_NAME,
} from '../services/demoSeed.service';
import {
  DEMO_BARANGAY_ID,
  nearContractService,
} from '../services/nearContract.service';
import { resetLocalCollectionsForTest } from '../repositories/db.helper';
import { proposalRepository } from '../repositories/proposal.repository';
import { userRepository } from '../repositories/user.repository';
import { authService } from '../services/auth.service';
import type { ProposalDocument, UserProfile } from '../types';

const TEST_REAL_PROPOSAL: ProposalDocument = {
  id: 'proj_public_belair_001',
  barangayId: 'brgy_1376020030',
  barangayName: 'Bel-Air',
  psgcCode: '1376020030',
  title: 'Barangay Bel-Air Solar Microgrid & Emergency Power Hub',
  category: 'Infrastructure & Resilience',
  summary: 'Installation of 15kW hybrid solar microgrid for the barangay evacuation and health center.',
  beneficiarySummary: '1,250 households in Barangay Bel-Air',
  proposerUid: 'uid_sk_belair',
  proposerName: 'SK Chair Maria Santos',
  proposerNearAccountId: 'sk-belair.fundora.testnet',
  beneficiaryNearAccountId: 'sk-belair.fundora.testnet',
  totalBudgetPhp: 280000,
  totalBudgetNear: '100',
  totalBudgetYocto: '100000000000000000000000000',
  lineItems: [
    {
      id: 'li_1',
      itemName: '15kW Hybrid Solar Inverter & Panels',
      category: 'Electrical & Solar',
      quantity: 1,
      unit: 'set',
      unitPricePhp: 180000,
      totalPricePhp: 180000,
    },
    {
      id: 'li_2',
      itemName: 'LiFePO4 Battery Rack & Mounting Hardware',
      category: 'Electrical & Solar',
      quantity: 1,
      unit: 'set',
      unitPricePhp: 100000,
      totalPricePhp: 100000,
    },
  ],
  milestones: [
    {
      index: 1,
      label: 'Phase 1 — Solar Equipment Mobilization (40%)',
      allocationBps: 4000,
      amountYocto: '40000000000000000000000000',
      amountPhpEquivalent: 112000,
      status: 'RELEASED',
    },
    {
      index: 2,
      label: 'Phase 2 — Grid Tie & Load Testing (60%)',
      allocationBps: 6000,
      amountYocto: '60000000000000000000000000',
      amountPhpEquivalent: 168000,
      status: 'EVIDENCE_SUBMITTED',
      evidencePhotoUrls: ['https://example.org/belair-solar-phase2.jpg'],
      evidenceHash: 'ab'.repeat(32),
    },
  ],
  status: 'ACTIVE_ESCROW',
  aiOverallRiskScore: 16,
  aiVerdict: 'PASS',
  nearEscrowCreatedTxHash: '8xRealOnChainTxHashBelAirSolar991122334455',
  approveVotes: 2,
  rejectVotes: 0,
  quorumBps: 6000,
  minVotesRequired: 3,
  createdAt: '2026-11-08T08:00:00.000Z',
  updatedAt: '2026-11-08T09:00:00.000Z',
};

describe('Phase 5: Transparency Hub, Digital Receipts & Judge Demo Mode', () => {
  beforeEach(() => {
    resetLocalCollectionsForTest();
    nearContractService.resetSandboxStateForTests();
    localStorage.clear();
  });

  it('1. Public Transparency Hub renders without login, separates on-chain state from off-chain metadata, and excludes PII', async () => {
    await proposalRepository.saveProposal(TEST_REAL_PROPOSAL);

    render(<TransparencyHub />);

    await waitFor(() => {
      expect(screen.getByText(/Barangay Bel-Air Solar Microgrid/i)).toBeTruthy();
    });

    // Verify clear distinction between on-chain and off-chain sections
    expect(screen.getAllByText(/1\. NEAR Contract Escrow & Quorum State/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2\. Off-Chain Proposal Metadata & AI Attestations/i).length).toBeGreaterThan(0);

    // Verify sanitized public view excludes resident IDs, KYC fields, or proposer UID
    const sanitized = buildSanitizedPublicProjectView(TEST_REAL_PROPOSAL, null, [], []);
    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toContain('uid_sk_belair');
    expect(serialized).not.toContain('idNumberHash');
    expect(serialized).not.toContain('kyc');
    expect(sanitized.proposerRoleLabel).toBe('SK Council Official (Bel-Air)');
  });

  it('2. Distinguishes real NEAR transactions from SIMULATED demo transactions and builds accurate NearBlocks URLs', () => {
    expect(isSimulatedTxHash('SimTx_DemoSanAntonio_Health_Escrow_001')).toBe(true);
    expect(isSimulatedTxHash('8xRealOnChainTxHashBelAirSolar991122334455', 'brgy_1376020030')).toBe(false);
    expect(isSimulatedTxHash('8xRealOnChainTxHashBelAirSolar991122334455', DEMO_BARANGAY_ID)).toBe(true);

    const realPayload: FundoraDigitalReceiptPayload = {
      receiptSerialNumber: 'FDR-RCPT-REAL-001',
      projectId: TEST_REAL_PROPOSAL.id,
      projectTitle: TEST_REAL_PROPOSAL.title,
      barangayId: TEST_REAL_PROPOSAL.barangayId,
      barangayName: TEST_REAL_PROPOSAL.barangayName,
      psgcCode: TEST_REAL_PROPOSAL.psgcCode,
      nearTxHash: '7xRealMilestoneReleaseTxHashPhase1BelAir',
      actionType: 'MILESTONE_RELEASE',
      purpose: 'Phase 1 — Solar Equipment Mobilization (40%)',
      milestoneIndex: 1,
      milestoneTitle: 'Phase 1 — Solar Equipment Mobilization',
      signerNearAccountId: 'admin.belair.testnet',
      recipientNearAccountId: 'sk-belair.fundora.testnet',
      amountYocto: '40000000000000000000000000',
      amountNear: '40',
      amountPhpEquivalent: 112000,
      currency: 'NEAR',
      transactionDateIso: '2026-11-08T10:00:00.000Z',
      verificationStatus: 'CONFIRMED',
      isSimulatedOrDemo: false,
    };

    const realMeta = resolveReceiptVerificationMetadata(realPayload);
    expect(realMeta.isSimulatedReceipt).toBe(false);
    expect(realMeta.statusBannerText).toContain('BLOCKCHAIN-CONFIRMED ON NEAR TESTNET');
    expect(realMeta.nearBlocksTxUrl).toBe(
      'https://testnet.nearblocks.io/txns/7xRealMilestoneReleaseTxHashPhase1BelAir'
    );
    expect(realMeta.nearBlocksSignerUrl).toBe(
      'https://testnet.nearblocks.io/address/admin.belair.testnet'
    );

    const simulatedPayload: FundoraDigitalReceiptPayload = {
      ...realPayload,
      receiptSerialNumber: 'FDR-RCPT-DEMO-001',
      barangayId: DEMO_BARANGAY_ID,
      nearTxHash: 'SimTx_DemoSanAntonio_Health_Escrow_001',
      verificationStatus: 'SIMULATED',
      isSimulatedOrDemo: true,
    };

    const simMeta = resolveReceiptVerificationMetadata(simulatedPayload);
    expect(simMeta.isSimulatedReceipt).toBe(true);
    expect(simMeta.nearBlocksTxUrl).toBeNull();
    expect(simMeta.statusBannerText).toContain('SIMULATED / DEMO SANDBOX RECEIPT');
    expect(simMeta.qrCodeTargetUrl).toContain('simRef=SimTx_DemoSanAntonio_Health_Escrow_001');
  });

  it('3. Validates receipt payloads, rejects incomplete data, generates PDF receipts, and renders ReceiptModal with QR code', async () => {
    expect(() =>
      validateReceiptPayload({
        receiptSerialNumber: '',
        projectId: '',
        amountNear: '-10',
      })
    ).toThrow(/ERR_INVALID_RECEIPT_DATA/i);

    const validPayload: FundoraDigitalReceiptPayload = {
      receiptSerialNumber: 'FDR-RCPT-BELAIR-001',
      projectId: TEST_REAL_PROPOSAL.id,
      projectTitle: TEST_REAL_PROPOSAL.title,
      barangayId: TEST_REAL_PROPOSAL.barangayId,
      barangayName: TEST_REAL_PROPOSAL.barangayName,
      psgcCode: TEST_REAL_PROPOSAL.psgcCode,
      nearTxHash: '7xRealMilestoneReleaseTxHashPhase1BelAir',
      actionType: 'MILESTONE_RELEASE',
      purpose: 'Phase 1 — Solar Equipment Mobilization',
      milestoneIndex: 1,
      signerNearAccountId: 'admin.belair.testnet',
      recipientNearAccountId: 'sk-belair.fundora.testnet',
      amountYocto: '40000000000000000000000000',
      amountNear: '40',
      amountPhpEquivalent: 112000,
      currency: 'NEAR',
      transactionDateIso: '2026-11-08T10:00:00.000Z',
      verificationStatus: 'CONFIRMED',
      isSimulatedOrDemo: false,
    };

    const integrityHash = await computeReceiptIntegrityHash(validPayload);
    expect(integrityHash).toMatch(/^[a-f0-9]{64}$/);

    const { pdfDoc, metadata, summaryText } = await generateReceiptPdfDocument(validPayload);
    expect(metadata.isSimulatedReceipt).toBe(false);
    expect(pdfDoc.getNumberOfPages()).toBe(1);
    expect(summaryText).toContain('FDR-RCPT-BELAIR-001');
    expect(summaryText).toContain('not a statutory BIR official tax invoice');

    render(
      <ReceiptModal
        receipt={validPayload}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('receipt-modal-dialog')).toBeTruthy();
    });

    expect(screen.getByTestId('receipt-verification-banner').textContent).toContain(
      'BLOCKCHAIN-CONFIRMED ON NEAR TESTNET'
    );
    await waitFor(() => {
      expect(screen.getByTestId('receipt-integrity-sha256').textContent).toMatch(/^[a-f0-9]{64}$/);
    });
    expect(screen.getByTestId('receipt-qr-container').querySelector('svg')).toBeTruthy();
  });

  it('4. ActivityView displays transaction verification badges and opens the Digital Receipt modal', async () => {
    await demoSandboxService.ensureDemoSandboxSeeded();
    const demoAdmin = demoSandboxService.getPersonaByRole('barangay_admin').profile;
    await userRepository.saveProfile(demoAdmin);
    authService.setCurrentSession({ uid: demoAdmin.uid, email: demoAdmin.email });

    render(
      <AuthProvider>
        <NearWalletProvider>
          <ActivityView />
        </NearWalletProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('activity-view-workspace')).toBeTruthy();
    });

    const receiptBtns = await waitFor(() =>
      screen.getAllByText(/Digital Receipt & QR/i)
    );
    expect(receiptBtns.length).toBeGreaterThan(0);

    fireEvent.click(receiptBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('receipt-modal-dialog')).toBeTruthy();
    });
  });

  it('5. Judge Demo Mode switches across all 5 personas in Brgy. San Antonio (Demo), enforces barangay isolation, and restores real user session on exit', async () => {
    const realResident: UserProfile = {
      uid: 'uid_real_resident_belair',
      email: 'real.resident@belair.ph',
      emailVerified: true,
      displayName: 'Carlos Mendoza (Real Resident)',
      firstName: 'Carlos',
      lastName: 'Mendoza',
      role: 'resident',
      barangayId: 'brgy_1376020030',
      barangayName: 'Bel-Air',
      psgcCode: '1376020030',
      cityMunicipalityName: 'City of Makati',
      provinceName: 'Metro Manila',
      regionName: 'National Capital Region (NCR)',
      zipCode: '1209',
      ageYears: 22,
      ageBracketStatus: 'eligible_youth',
      verificationStatus: 'approved',
      nearAccountId: 'carlos.belair.testnet',
      createdAt: '2026-11-08T00:00:00.000Z',
      updatedAt: '2026-11-08T00:00:00.000Z',
    };

    await userRepository.saveProfile(realResident);
    authService.setCurrentSession({ uid: realResident.uid, email: realResident.email });

    const SessionInspector: React.FC = () => {
      const { userProfile } = useAuth();
      return (
        <div>
          <span data-testid="active-uid">{userProfile?.uid || 'none'}</span>
          <span data-testid="active-role">{userProfile?.role || 'none'}</span>
          <span data-testid="active-barangay">{userProfile?.barangayId || 'none'}</span>
          <JudgeDemoToolbar />
        </div>
      );
    };

    render(
      <AuthProvider>
        <NearWalletProvider>
          <SessionInspector />
        </NearWalletProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('active-uid').textContent).toBe('uid_real_resident_belair');
    });

    // Launch Judge Demo Mode
    fireEvent.click(screen.getByTestId('enter-judge-demo-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('judge-demo-active-toolbar')).toBeTruthy();
    });

    expect(screen.getByTestId('active-barangay').textContent).toBe(DEMO_BARANGAY_ID);
    expect(screen.getByTestId('active-role').textContent).toBe('barangay_admin');

    // Switch through SK Official, Resident, Public Viewer, and System Admin
    fireEvent.click(screen.getByTestId('demo-persona-btn-sk_official'));
    await waitFor(() => {
      expect(screen.getByTestId('active-role').textContent).toBe('sk_official');
    });

    fireEvent.click(screen.getByTestId('demo-persona-btn-resident'));
    await waitFor(() => {
      expect(screen.getByTestId('active-role').textContent).toBe('resident');
    });

    fireEvent.click(screen.getByTestId('demo-persona-btn-viewer'));
    await waitFor(() => {
      expect(screen.getByTestId('active-role').textContent).toBe('viewer');
    });

    fireEvent.click(screen.getByTestId('demo-persona-btn-system_admin'));
    await waitFor(() => {
      expect(screen.getByTestId('active-role').textContent).toBe('system_admin');
    });

    // Verify strict barangay isolation prevents demo mode from mutating real Bel-Air data
    expect(() =>
      demoSandboxService.assertDemoBarangayIsolation('brgy_1376020030')
    ).toThrow(/ERR_DEMO_ISOLATION_VIOLATION/i);

    expect(() =>
      demoSandboxService.assertDemoBarangayIsolation(DEMO_BARANGAY_ID)
    ).not.toThrow();

    // Verify demo projects were seeded in Brgy. San Antonio (Demo)
    const demoProposals = await proposalRepository.listByBarangay(DEMO_BARANGAY_ID);
    expect(demoProposals.length).toBeGreaterThanOrEqual(3);
    expect(demoProposals.every((p) => p.barangayName === DEMO_BARANGAY_NAME)).toBe(true);

    // Exit Judge Demo Mode and confirm real user session is restored
    fireEvent.click(screen.getByTestId('exit-judge-demo-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('active-uid').textContent).toBe('uid_real_resident_belair');
    });
    expect(screen.getByTestId('active-barangay').textContent).toBe('brgy_1376020030');
    expect(screen.getByTestId('active-role').textContent).toBe('resident');
  });
});
