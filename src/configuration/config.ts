/**
 * Fundora — Client Environment & Protocol Configuration
 * Note: Gemini AI keys and NEAR Auditor private keys are strictly server-only
 * and must NEVER be exposed via `VITE_*` client environment variables.
 */

export const APP_CONFIG = {
  appName: 'Fundora',
  tagline: 'NEAR-Native AI-Audited Civic Treasury & Programmable Milestone Escrow',
  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  },
  near: {
    networkId: (import.meta.env.VITE_NEAR_NETWORK_ID || 'testnet') as 'testnet' | 'mainnet',
    contractId: import.meta.env.VITE_NEAR_CONTRACT_ID || 'contract.fundora.testnet',
    aiAuditorAccountId:
      import.meta.env.VITE_NEAR_AUDITOR_ID || 'auditor.fundora.testnet',
    storageReserveYocto: '50000000000000000000000', // 0.05 NEAR per FD-SDLC-05
    storageReserveNear: '0.05',
    functionCallAllowanceYocto: '250000000000000000000000', // 0.25 NEAR gas allowance
    functionCallAllowedMethods: ['submit_milestone_proof', 'vote_milestone'] as const,
    rpcUrl: import.meta.env.VITE_NEAR_RPC_URL || 'https://rpc.testnet.near.org',
    explorerBaseUrl:
      import.meta.env.VITE_NEAR_EXPLORER_URL || 'https://testnet.nearblocks.io',
    phpPerNearRate: Number(import.meta.env.VITE_PHP_PER_NEAR_RATE || 280),
  },
  governance: {
    defaultQuorumBps: 6000, // 60% supermajority
    defaultMinVotes: 3, // Standard multi-resident floor
    demoBarangayId: 'brgy_demo_001',
    demoMinVotes: 1, // Single-judge sandbox exception strictly for brgy_demo_001
    milestoneSplitBps: [4000, 4000, 2000] as const, // 40% / 40% / 20%
  },
  psgc: {
    apiBaseUrl: 'https://psgc.gitlab.io/api',
    timeoutMs: 3000,
  },
} as const;

export function isFirebaseConfigured(): boolean {
  return Boolean(
    APP_CONFIG.firebase.apiKey &&
      APP_CONFIG.firebase.projectId &&
      APP_CONFIG.firebase.apiKey !== 'your_firebase_api_key'
  );
}
