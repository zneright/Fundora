/**
 * Fundora — Non-Custodial NEAR Wallet Context (`NearWalletContext.tsx`)
 *
 * Provides NEAR Wallet Selector state (`MyNearWallet`, `Meteor Wallet`, `HERE Wallet`),
 * account switching, network mismatch detection, scoped Function-Call Access Key sessions
 * (`submit_milestone_proof`, `vote_milestone`), transaction lifecycle tracking
 * (`SUBMITTED`, `PENDING`, `SUCCESSFUL`, `FAILED`, `RECONCILIATION_REQUIRED`),
 * and on-chain to Firestore state reconciliation.
 *
 * Security Invariant:
 * Strictly zero Full-Access private keys or secret phrases are ever stored.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { APP_CONFIG } from '../configuration/config';
import { useAuth } from './AuthContext';
import { walletRepository, isValidNearAccountId } from '../repositories/wallet.repository';
import { userRepository } from '../repositories/user.repository';
import { proposalRepository } from '../repositories/proposal.repository';
import {
  nearContractService,
  SUPPORTED_WALLET_PROVIDERS,
  type AccessKeySessionMode,
  type ExecutionEnvironmentMode,
  type SupportedWalletProviderId,
  type TransactionLifecycleRecord,
  type WalletProviderMetadata,
} from '../services/nearContract.service';
import type { TransactionReferenceDocument } from '../types';

export interface ConnectWalletOptions {
  walletProviderId: SupportedWalletProviderId;
  accountId: string;
  networkId?: 'testnet' | 'mainnet';
  enableFunctionCallSession?: boolean;
}

export interface NearWalletContextValue {
  isConnected: boolean;
  activeAccountId: string | null;
  connectedAccounts: string[];
  selectedWalletId: SupportedWalletProviderId | null;
  networkId: 'testnet' | 'mainnet';
  networkMismatchError: string | null;
  accessKeyMode: AccessKeySessionMode;
  functionCallAllowedMethods: ReadonlyArray<string>;
  executionEnvironment: ExecutionEnvironmentMode;
  supportedWallets: ReadonlyArray<WalletProviderMetadata>;
  contractId: string;
  activeTransaction: TransactionLifecycleRecord | null;
  transactionHistory: TransactionReferenceDocument[];
  pendingReconciliations: TransactionLifecycleRecord[];
  connectWallet: (options: ConnectWalletOptions) => Promise<void>;
  disconnectWallet: () => Promise<void>;
  switchAccount: (nextAccountId: string) => Promise<void>;
  setNetworkId: (networkId: 'testnet' | 'mainnet') => void;
  setAccessKeyMode: (mode: AccessKeySessionMode) => void;
  setActiveTransaction: (tx: TransactionLifecycleRecord | null) => void;
  refreshTransactionHistory: () => Promise<void>;
  reconcileProject: (projectId: string) => Promise<boolean>;
}

const NearWalletContext = createContext<NearWalletContextValue>({
  isConnected: false,
  activeAccountId: null,
  connectedAccounts: [],
  selectedWalletId: null,
  networkId: APP_CONFIG.near.networkId,
  networkMismatchError: null,
  accessKeyMode: 'full_access_wallet',
  functionCallAllowedMethods: APP_CONFIG.near.functionCallAllowedMethods,
  executionEnvironment: 'simulated_sandbox',
  supportedWallets: SUPPORTED_WALLET_PROVIDERS,
  contractId: APP_CONFIG.near.contractId,
  activeTransaction: null,
  transactionHistory: [],
  pendingReconciliations: [],
  connectWallet: async () => {},
  disconnectWallet: async () => {},
  switchAccount: async () => {},
  setNetworkId: () => {},
  setAccessKeyMode: () => {},
  setActiveTransaction: () => {},
  refreshTransactionHistory: async () => {},
  reconcileProject: async () => false,
});

export const NearWalletProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { userProfile, refreshProfile } = useAuth();
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<string[]>([]);
  const [selectedWalletId, setSelectedWalletId] =
    useState<SupportedWalletProviderId | null>(null);
  const [networkId, setNetworkIdState] = useState<'testnet' | 'mainnet'>(
    APP_CONFIG.near.networkId
  );
  const [accessKeyMode, setAccessKeyMode] =
    useState<AccessKeySessionMode>('full_access_wallet');
  const [activeTransaction, setActiveTransaction] =
    useState<TransactionLifecycleRecord | null>(null);
  const [transactionHistory, setTransactionHistory] = useState<
    TransactionReferenceDocument[]
  >([]);
  const [pendingReconciliations, setPendingReconciliations] = useState<
    TransactionLifecycleRecord[]
  >([]);

  const networkMismatchError = useMemo(() => {
    if (networkId !== APP_CONFIG.near.networkId) {
      return `ERR_NETWORK_MISMATCH: Connected wallet network "${networkId}" does not match configured Fundora network "${APP_CONFIG.near.networkId}".`;
    }
    if (activeAccountId) {
      if (APP_CONFIG.near.networkId === 'testnet' && activeAccountId.endsWith('.near')) {
        return `ERR_NETWORK_MISMATCH: Mainnet account "${activeAccountId}" cannot transact on NEAR Testnet.`;
      }
      if (APP_CONFIG.near.networkId === 'mainnet' && activeAccountId.endsWith('.testnet')) {
        return `ERR_NETWORK_MISMATCH: Testnet account "${activeAccountId}" cannot transact on NEAR Mainnet.`;
      }
    }
    return null;
  }, [networkId, activeAccountId]);

  const refreshTransactionHistory = useCallback(async () => {
    if (!userProfile?.barangayId) {
      setTransactionHistory([]);
      setPendingReconciliations([]);
      return;
    }
    const [txs] = await Promise.all([
      proposalRepository.listTransactionsByBarangay(userProfile.barangayId),
    ]);
    setTransactionHistory(txs);
    setPendingReconciliations(
      nearContractService.getPendingReconciliationIntents(userProfile.barangayId)
    );
  }, [userProfile?.barangayId]);

  // Restore linked NEAR wallet for authenticated user
  useEffect(() => {
    let active = true;
    async function restoreUserWallet() {
      if (!userProfile) {
        if (active) {
          setActiveAccountId(null);
          setConnectedAccounts([]);
          setSelectedWalletId(null);
          setTransactionHistory([]);
          setPendingReconciliations([]);
        }
        return;
      }

      const links = await walletRepository.listByUid(userProfile.uid);
      if (!active) return;

      if (links.length > 0) {
        const primary = links.find((l) => l.isPrimary) || links[0];
        setActiveAccountId(primary.nearAccountId);
        setConnectedAccounts(links.map((l) => l.nearAccountId));
        setSelectedWalletId(
          (primary.walletProviderId as SupportedWalletProviderId) || 'my-near-wallet'
        );
      } else if (userProfile.nearAccountId) {
        setActiveAccountId(userProfile.nearAccountId);
        setConnectedAccounts([userProfile.nearAccountId]);
        setSelectedWalletId('my-near-wallet');
      }

      await refreshTransactionHistory();
    }
    void restoreUserWallet();
    return () => {
      active = false;
    };
  }, [userProfile, refreshTransactionHistory]);

  const connectWallet = useCallback(
    async (options: ConnectWalletOptions) => {
      const providerSupported = SUPPORTED_WALLET_PROVIDERS.some(
        (w) => w.id === options.walletProviderId
      );
      if (!providerSupported) {
        throw new Error(
          `ERR_UNSUPPORTED_WALLET_PROVIDER: Wallet provider "${options.walletProviderId}" is not supported.`
        );
      }

      const targetNet = options.networkId || networkId;
      if (targetNet !== APP_CONFIG.near.networkId) {
        setNetworkIdState(targetNet);
        throw new Error(
          `ERR_NETWORK_MISMATCH: Cannot connect "${targetNet}" wallet to "${APP_CONFIG.near.networkId}" environment.`
        );
      }

      const cleanAccount = (options.accountId || '').trim().toLowerCase();
      if (!isValidNearAccountId(cleanAccount)) {
        throw new Error(
          `ERR_INVALID_NEAR_ACCOUNT: "${options.accountId}" is not a valid NEAR Account ID.`
        );
      }

      if (APP_CONFIG.near.networkId === 'testnet' && cleanAccount.endsWith('.near')) {
        throw new Error(
          `ERR_NETWORK_MISMATCH: Mainnet account "${cleanAccount}" cannot connect to NEAR Testnet.`
        );
      }

      if (userProfile) {
        const linkId = `wlink_${userProfile.uid}_${cleanAccount.replace(/[^a-z0-9]/g, '_')}`;
        await walletRepository.linkNearAccount({
          id: linkId,
          uid: userProfile.uid,
          barangayId: userProfile.barangayId,
          nearAccountId: cleanAccount,
          networkId: APP_CONFIG.near.networkId,
          walletProviderId: options.walletProviderId,
          isPrimary: true,
          linkedAt: new Date().toISOString(),
        });

        await userRepository.updateProfile(userProfile.uid, {
          nearAccountId: cleanAccount,
        });

        // Provision sandbox role membership ONLY if user is verified & approved for their role
        if (userProfile.verificationStatus === 'approved') {
          await nearContractService.ensureBarangayProvisioned({
            barangay_id: userProfile.barangayId,
            psgc_code: userProfile.psgcCode,
            name: userProfile.barangayName,
            admin_account:
              userProfile.role === 'barangay_admin' || userProfile.role === 'system_admin'
                ? cleanAccount
                : undefined,
            sk_accounts: userProfile.role === 'sk_official' ? [cleanAccount] : undefined,
            resident_accounts:
              userProfile.role === 'resident' &&
              userProfile.ageBracketStatus === 'eligible_youth'
                ? [cleanAccount]
                : undefined,
          });
        }

        await refreshProfile();
      }

      setSelectedWalletId(options.walletProviderId);
      setActiveAccountId(cleanAccount);
      setConnectedAccounts((prev) =>
        prev.includes(cleanAccount) ? prev : [...prev, cleanAccount]
      );
      setAccessKeyMode(
        options.enableFunctionCallSession ? 'function_call_session' : 'full_access_wallet'
      );
      await refreshTransactionHistory();
    },
    [networkId, userProfile, refreshProfile, refreshTransactionHistory]
  );

  const disconnectWallet = useCallback(async () => {
    if (userProfile && activeAccountId) {
      await walletRepository.unlinkNearAccount(userProfile.uid, activeAccountId);
      await userRepository.updateProfile(userProfile.uid, {
        nearAccountId: undefined,
      });
      await refreshProfile();
    }
    setActiveAccountId(null);
    setConnectedAccounts([]);
    setSelectedWalletId(null);
    setAccessKeyMode('full_access_wallet');
    setActiveTransaction(null);
  }, [userProfile, activeAccountId, refreshProfile]);

  const switchAccount = useCallback(
    async (nextAccountId: string) => {
      const cleanNext = (nextAccountId || '').trim().toLowerCase();
      if (!isValidNearAccountId(cleanNext)) {
        throw new Error(`ERR_INVALID_NEAR_ACCOUNT: "${nextAccountId}"`);
      }
      if (APP_CONFIG.near.networkId === 'testnet' && cleanNext.endsWith('.near')) {
        throw new Error(
          `ERR_NETWORK_MISMATCH: Mainnet account "${cleanNext}" cannot be selected on NEAR Testnet.`
        );
      }

      if (userProfile) {
        const linkId = `wlink_${userProfile.uid}_${cleanNext.replace(/[^a-z0-9]/g, '_')}`;
        await walletRepository.linkNearAccount({
          id: linkId,
          uid: userProfile.uid,
          barangayId: userProfile.barangayId,
          nearAccountId: cleanNext,
          networkId: APP_CONFIG.near.networkId,
          walletProviderId: selectedWalletId || 'my-near-wallet',
          isPrimary: true,
          linkedAt: new Date().toISOString(),
        });
        await userRepository.updateProfile(userProfile.uid, {
          nearAccountId: cleanNext,
        });

        if (userProfile.verificationStatus === 'approved') {
          await nearContractService.ensureBarangayProvisioned({
            barangay_id: userProfile.barangayId,
            psgc_code: userProfile.psgcCode,
            name: userProfile.barangayName,
            admin_account:
              userProfile.role === 'barangay_admin' || userProfile.role === 'system_admin'
                ? cleanNext
                : undefined,
            sk_accounts: userProfile.role === 'sk_official' ? [cleanNext] : undefined,
            resident_accounts:
              userProfile.role === 'resident' &&
              userProfile.ageBracketStatus === 'eligible_youth'
                ? [cleanNext]
                : undefined,
          });
        }
        await refreshProfile();
      }

      setActiveAccountId(cleanNext);
      setConnectedAccounts((prev) =>
        prev.includes(cleanNext) ? prev : [...prev, cleanNext]
      );
      await refreshTransactionHistory();
    },
    [userProfile, selectedWalletId, refreshProfile, refreshTransactionHistory]
  );

  const setNetworkId = useCallback((nextNet: 'testnet' | 'mainnet') => {
    setNetworkIdState(nextNet);
  }, []);

  const reconcileProject = useCallback(
    async (projectId: string): Promise<boolean> => {
      const res = await nearContractService.reconcileProjectState(projectId);
      await refreshTransactionHistory();
      if (activeTransaction?.projectId === projectId && res.reconciled) {
        setActiveTransaction((prev) =>
          prev
            ? {
                ...prev,
                status: 'SUCCESSFUL',
                reconciliationReason: undefined,
                updatedAt: new Date().toISOString(),
              }
            : null
        );
      }
      return res.reconciled;
    },
    [refreshTransactionHistory, activeTransaction?.projectId]
  );

  return (
    <NearWalletContext.Provider
      value={{
        isConnected: Boolean(activeAccountId),
        activeAccountId,
        connectedAccounts,
        selectedWalletId,
        networkId,
        networkMismatchError,
        accessKeyMode,
        functionCallAllowedMethods: APP_CONFIG.near.functionCallAllowedMethods,
        executionEnvironment: 'simulated_sandbox',
        supportedWallets: SUPPORTED_WALLET_PROVIDERS,
        contractId: APP_CONFIG.near.contractId,
        activeTransaction,
        transactionHistory,
        pendingReconciliations,
        connectWallet,
        disconnectWallet,
        switchAccount,
        setNetworkId,
        setAccessKeyMode,
        setActiveTransaction,
        refreshTransactionHistory,
        reconcileProject,
      }}
    >
      {children}
    </NearWalletContext.Provider>
  );
};

export function useNearWallet(): NearWalletContextValue {
  return useContext(NearWalletContext);
}

