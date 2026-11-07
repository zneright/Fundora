/**
 * Fundora — Hardened Database Access Helper (`db.helper.ts`)
 * Enforces FD-SDLC-06 collection boundaries, blocks prohibited private-key fields,
 * and provides seamless Firestore + deterministic local store persistence.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  type WhereFilterOp,
} from 'firebase/firestore';
import { firestoreDb } from '../services/firebase';
import type { BarangayDocument } from '../types';

const FORBIDDEN_SECRET_FIELDS = new Set([
  'inAppWalletSecret',
  'privateKey',
  'secretKey',
  'seedPhrase',
  'mnemonic',
]);

export function assertNoForbiddenSecretFields(payload: unknown, collectionName: string): void {
  if (!payload || typeof payload !== 'object') return;
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (FORBIDDEN_SECRET_FIELDS.has(key)) {
      throw new Error(
        `Security Violation: Field "${key}" is strictly forbidden in collection "${collectionName}". Fundora never stores private keys or secret phrases.`
      );
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      assertNoForbiddenSecretFields(value, collectionName);
    }
  }
}

const STORAGE_PREFIX = 'fundora_collection_';
const memoryCollections = new Map<string, Map<string, Record<string, unknown>>>();

const DEFAULT_SEEDED_BARANGAYS: BarangayDocument[] = [
  {
    id: 'brgy_0421090180',
    psgcCode: '0421090180',
    name: 'Bucandala III',
    regionName: 'Region IV-A (CALABARZON)',
    regionCode: '040000000',
    provinceName: 'Cavite',
    provinceCode: '042100000',
    cityMunicipalityName: 'City of Imus',
    cityMunicipalityCode: '042109000',
    zipCode: '4103',
    hallAddress: 'Bucandala III Barangay Hall, Imus City, Cavite',
    status: 'approved',
    adminUid: 'admin_bucandala3',
    adminFullName: 'Hon. Roberto Bautista',
    nearTreasuryAccountId: 'bucandala3.fundora.testnet',
    quorumBps: 6000,
    minVotesRequired: 3,
    termStartDate: '2025-11-30',
    termEndDate: '2028-11-30',
    isDemoJurisdiction: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'brgy_1376020030',
    psgcCode: '1376020030',
    name: 'Bel-Air',
    regionName: 'National Capital Region (NCR)',
    regionCode: '130000000',
    provinceName: 'Metro Manila',
    provinceCode: '130000000-MM',
    cityMunicipalityName: 'City of Makati',
    cityMunicipalityCode: '137602000',
    zipCode: '1209',
    hallAddress: 'Solar St., Bel-Air Village, Makati City',
    status: 'approved',
    adminUid: 'admin_belair',
    adminFullName: 'Hon. Constancia Lichauco',
    nearTreasuryAccountId: 'belair.fundora.testnet',
    quorumBps: 6000,
    minVotesRequired: 3,
    termStartDate: '2025-11-30',
    termEndDate: '2028-11-30',
    isDemoJurisdiction: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'brgy_demo_001',
    psgcCode: '1374030250',
    name: 'San Antonio',
    regionName: 'National Capital Region (NCR)',
    regionCode: '130000000',
    provinceName: 'Metro Manila',
    provinceCode: '130000000-MM',
    cityMunicipalityName: 'City of Pasig',
    cityMunicipalityCode: '137403000',
    zipCode: '1605',
    hallAddress: 'Gen. Malvar St., Ortigas Center, Brgy. San Antonio, Pasig City',
    status: 'approved',
    adminUid: 'admin_demo_sanantonio',
    adminFullName: 'Hon. Raymond Lising (Demo Sandbox)',
    nearTreasuryAccountId: 'sanantonio-demo.fundora.testnet',
    quorumBps: 6000,
    minVotesRequired: 1, // Single-judge sandbox exception strictly for brgy_demo_001
    termStartDate: '2025-11-30',
    termEndDate: '2028-11-30',
    isDemoJurisdiction: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

function getLocalCollectionMap(collectionName: string): Map<string, Record<string, unknown>> {
  let colMap = memoryCollections.get(collectionName);
  if (!colMap) {
    colMap = new Map<string, Record<string, unknown>>();
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${collectionName}`);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, Record<string, unknown>>;
          for (const [k, v] of Object.entries(parsed)) {
            colMap.set(k, v);
          }
        }
      } catch {
        // Ignore storage read error
      }
    }
    if (collectionName === 'barangays' && colMap.size === 0) {
      for (const b of DEFAULT_SEEDED_BARANGAYS) {
        colMap.set(b.id, { ...b });
      }
    }
    memoryCollections.set(collectionName, colMap);
  }
  return colMap;
}

function persistLocalCollectionMap(
  collectionName: string,
  colMap: Map<string, Record<string, unknown>>
): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const obj: Record<string, Record<string, unknown>> = {};
      for (const [k, v] of colMap.entries()) {
        obj[k] = v;
      }
      window.localStorage.setItem(`${STORAGE_PREFIX}${collectionName}`, JSON.stringify(obj));
    } catch {
      // Ignore quota errors in tests
    }
  }
}

export function resetLocalCollectionsForTest(): void {
  memoryCollections.clear();
  if (typeof window !== 'undefined' && window.localStorage) {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k));
  }
}

export async function dbGetById<T>(collectionName: string, docId: string): Promise<T | null> {
  if (firestoreDb) {
    const snap = await getDoc(doc(firestoreDb, collectionName, docId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as object) } as T;
  }
  const col = getLocalCollectionMap(collectionName);
  const found = col.get(docId);
  return found ? (structuredClone(found) as T) : null;
}

export async function dbSetDocument<T extends object>(
  collectionName: string,
  docId: string,
  data: T
): Promise<T> {
  assertNoForbiddenSecretFields(data, collectionName);

  if (firestoreDb) {
    await setDoc(doc(firestoreDb, collectionName, docId), data as Record<string, unknown>, {
      merge: true,
    });
    return data;
  }

  const col = getLocalCollectionMap(collectionName);
  const existing = col.get(docId) || {};
  const merged = { ...existing, ...(data as Record<string, unknown>) };
  col.set(docId, merged);
  persistLocalCollectionMap(collectionName, col);
  return structuredClone(merged) as T;
}

export async function dbUpdateDocument<T extends object>(
  collectionName: string,
  docId: string,
  partial: Partial<T>
): Promise<void> {
  assertNoForbiddenSecretFields(partial, collectionName);

  if (firestoreDb) {
    await updateDoc(doc(firestoreDb, collectionName, docId), partial as Record<string, unknown>);
    return;
  }

  const col = getLocalCollectionMap(collectionName);
  const existing = col.get(docId) || {};
  col.set(docId, { ...existing, ...(partial as Record<string, unknown>) });
  persistLocalCollectionMap(collectionName, col);
}

export async function dbDeleteDocument(collectionName: string, docId: string): Promise<void> {
  if (firestoreDb) {
    await deleteDoc(doc(firestoreDb, collectionName, docId));
    return;
  }
  const col = getLocalCollectionMap(collectionName);
  col.delete(docId);
  persistLocalCollectionMap(collectionName, col);
}

export async function dbListCollection<T>(
  collectionName: string,
  filters?: Array<{ field: string; op: WhereFilterOp; value: unknown }>
): Promise<T[]> {
  if (firestoreDb) {
    const colRef = collection(firestoreDb, collectionName);
    const constraints = (filters || []).map((f) => where(f.field, f.op, f.value));
    const q = constraints.length > 0 ? query(colRef, ...constraints) : query(colRef);
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as T);
  }

  const col = getLocalCollectionMap(collectionName);
  const all = Array.from(col.values());
  const filtered = all.filter((item) => {
    if (!filters || filters.length === 0) return true;
    return filters.every((f) => {
      const val = item[f.field];
      if (f.op === '==') return val === f.value;
      if (f.op === '!=') return val !== f.value;
      if (f.op === 'in' && Array.isArray(f.value)) return f.value.includes(val);
      return true;
    });
  });

  return structuredClone(filtered) as T[];
}
