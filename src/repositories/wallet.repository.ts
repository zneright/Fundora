/**
 * Fundora — Wallet Link Repository (`wallet_links/{linkId}`)
 * Stores ONLY public NEAR AccountIds (`alice.testnet`).
 * Any attempt to persist private keys or `inAppWalletSecret` throws a security error.
 */

import {
  assertNoForbiddenSecretFields,
  dbDeleteDocument,
  dbGetById,
  dbListCollection,
  dbSetDocument,
} from './db.helper';
import type { WalletLinkDocument } from '../types';

const NEAR_ACCOUNT_ID_REGEX = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

export function isValidNearAccountId(accountId: string): boolean {
  const clean = accountId.trim();
  if (clean.length < 2 || clean.length > 64) return false;
  return NEAR_ACCOUNT_ID_REGEX.test(clean);
}

export const walletRepository = {
  async getByUid(uid: string): Promise<WalletLinkDocument | null> {
    const links = await dbListCollection<WalletLinkDocument>('wallet_links', [
      { field: 'uid', op: '==', value: uid },
    ]);
    return links.find((l) => l.isPrimary) || links[0] || null;
  },

  async listByUid(uid: string): Promise<WalletLinkDocument[]> {
    return dbListCollection<WalletLinkDocument>('wallet_links', [
      { field: 'uid', op: '==', value: uid },
    ]);
  },

  async getByNearAccountId(nearAccountId: string): Promise<WalletLinkDocument | null> {
    const clean = nearAccountId.trim().toLowerCase();
    const links = await dbListCollection<WalletLinkDocument>('wallet_links', [
      { field: 'nearAccountId', op: '==', value: clean },
    ]);
    return links[0] || null;
  },

  async linkNearAccount(payload: WalletLinkDocument): Promise<WalletLinkDocument> {
    assertNoForbiddenSecretFields(payload, 'wallet_links');
    const cleanAccount = payload.nearAccountId.trim().toLowerCase();
    if (!isValidNearAccountId(cleanAccount)) {
      throw new Error(`Invalid NEAR Account ID format: "${payload.nearAccountId}"`);
    }

    // Enforce 1-wallet-1-user Sybil protection across the platform
    const existingBinding = await this.getByNearAccountId(cleanAccount);
    if (existingBinding && existingBinding.uid !== payload.uid) {
      throw new Error(
        `ERR_WALLET_ALREADY_BOUND: NEAR account "${cleanAccount}" is already linked to another user profile.`
      );
    }

    const existingUserLinks = await this.listByUid(payload.uid);
    for (const prev of existingUserLinks) {
      if (prev.id !== payload.id && prev.isPrimary && payload.isPrimary) {
        await dbSetDocument<WalletLinkDocument>('wallet_links', prev.id, {
          ...prev,
          isPrimary: false,
        });
      }
    }

    return dbSetDocument<WalletLinkDocument>('wallet_links', payload.id, {
      ...payload,
      nearAccountId: cleanAccount,
    });
  },

  async unlinkNearAccount(uid: string, nearAccountId: string): Promise<void> {
    const cleanAccount = nearAccountId.trim().toLowerCase();
    const userLinks = await this.listByUid(uid);
    for (const link of userLinks) {
      if (link.nearAccountId.toLowerCase() === cleanAccount) {
        await dbDeleteDocument('wallet_links', link.id);
      }
    }
  },

  async getById(linkId: string): Promise<WalletLinkDocument | null> {
    return dbGetById<WalletLinkDocument>('wallet_links', linkId);
  },
};
