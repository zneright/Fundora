/**
 * Fundora — Audit Log Repository (`audit_logs/{logId}`)
 */

import { dbListCollection, dbSetDocument } from './db.helper';
import type { AuditLogEntry } from '../types';

export const auditRepository = {
  async recordEvent(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>): Promise<AuditLogEntry> {
    const fullEntry: AuditLogEntry = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };
    return dbSetDocument<AuditLogEntry>('audit_logs', fullEntry.id, fullEntry);
  },

  async listByBarangay(barangayId: string): Promise<AuditLogEntry[]> {
    const logs = await dbListCollection<AuditLogEntry>('audit_logs', [
      { field: 'barangayId', op: '==', value: barangayId },
    ]);
    return logs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
};
