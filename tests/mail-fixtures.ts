import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { TextCipher, MailState } from '../src/application/email/ports';
import type { MailConfig, MailContent } from '../src/domain/email';

export const mailConfigData: MailConfig = {
  clientId: '11111111-2222-4333-8444-555555555555',
  tenantId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  autoSync: false,
};
export const mailContent: MailContent = {
  threadId: 'fake-thread',
  subject: 'Evidencia de pruebas',
  sender: 'qa@example.test',
  senderName: 'Equipo de pruebas',
  receivedAt: '2026-09-29T10:00:00.000Z',
  preview: 'Revisar la evidencia adjunta.',
  isRead: false,
  importance: 'normal',
  hasAttachments: true,
};
export const mailState: MailState = {
  config: mailConfigData,
  account: {
    id: 'fake-account',
    address: 'qa@example.test',
    cache: 'synthetic-cache-for-testing',
    cursor: null,
    lastSyncedAt: null,
    hasMore: false,
    needsReconnect: false,
  },
};
// Tests use independent ephemeral encryption. Production always uses Electron safeStorage.
export function testCipher(): TextCipher {
  const key = randomBytes(32);
  return {
    assertAvailable() {},
    encrypt(text) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
    },
    decrypt(value) {
      const data = Buffer.from(value);
      const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
      decipher.setAuthTag(data.subarray(12, 28));
      return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8');
    },
  };
}
