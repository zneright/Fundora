/**
 * Fundora — Wallet Link Repository (`wallet_links/{linkId}`)
 * Stores ONLY public NEAR AccountIds (`alice.testnet`).
 * Any attempt to persist private keys or `inAppWalletSecret` throws a security error.
 */

import {
  assertNoForbiddenSecretFields,
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

  async linkNearAccount(payload: WalletLinkDocument): Promise<WalletLinkDocument> {
    assertNoForbiddenSecretFields(payload, 'wallet_links');
    if (!isValidNearAccountId(payload.nearAccountId)) {
      throw new Error(`Invalid NEAR Account ID format: "${payload.nearAccountId}"`);
    }
    return dbSetDocument<WalletLinkDocument>('wallet_links', payload.id, payload);
  },

  async getById(linkId: string): Promise<WalletLinkDocument | null> {
    return dbGetById<WalletLinkDocument>('wallet_links', linkId);
  },
};
