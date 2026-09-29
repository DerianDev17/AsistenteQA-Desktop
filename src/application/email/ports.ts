import type { MailConfig, MailChange, MailPage } from '../../domain/email';

// These private records never cross the preload boundary.
export interface MailAccount {
  id: string;
  address: string;
  cache: string;
  cursor: string | null;
  lastSyncedAt: string | null;
  hasMore: boolean;
  needsReconnect: boolean;
}
export interface MailState {
  config: MailConfig | null;
  account: MailAccount | null;
}
export interface MailVault {
  load(): Promise<MailState>;
  save(state: MailState): Promise<void>;
  assertAvailable(): void;
}
export interface MailAuth {
  connect(
    config: MailConfig,
    signal: AbortSignal,
  ): Promise<{ id: string; address: string; cache: string }>;
  token(
    config: MailConfig,
    account: MailAccount,
    signal: AbortSignal,
  ): Promise<{ accessToken: string; cache: string }>;
}
export interface MailProvider {
  page(
    token: string,
    cursor: string | null,
    since: string,
    signal: AbortSignal,
  ): Promise<{ changes: MailChange[]; cursor: string; hasMore: boolean }>;
}
export interface MailRepository {
  apply(accountId: string, changes: MailChange[], since: string): Promise<void>;
  list(accountId: string, page: number): Promise<MailPage>;
  clear(): Promise<void>;
}
export interface TextCipher {
  encrypt(value: string): Buffer;
  decrypt(value: Uint8Array): string;
  assertAvailable(): void;
}
