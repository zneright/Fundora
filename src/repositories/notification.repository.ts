/**
 * Fundora — Notifications Repository (`notifications/{notifId}`)
 */

import { dbListCollection, dbSetDocument, dbUpdateDocument } from './db.helper';
import type { NotificationEntry } from '../types';

export const notificationRepository = {
  async createNotification(
    entry: Omit<NotificationEntry, 'id' | 'createdAt' | 'read'>
  ): Promise<NotificationEntry> {
    const notif: NotificationEntry = {
      ...entry,
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    return dbSetDocument<NotificationEntry>('notifications', notif.id, notif);
  },

  async listForUser(recipientUid: string): Promise<NotificationEntry[]> {
    const list = await dbListCollection<NotificationEntry>('notifications', [
      { field: 'recipientUid', op: '==', value: recipientUid },
    ]);
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async markAsRead(notifId: string): Promise<void> {
    await dbUpdateDocument<NotificationEntry>('notifications', notifId, { read: true });
  },
};
