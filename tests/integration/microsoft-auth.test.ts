import { createHash } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
import { mailConfigData, mailState } from '../mail-fixtures';

const mock = vi.hoisted(() => ({
  config: vi.fn(),
  url: vi.fn(),
  byCode: vi.fn(),
  silent: vi.fn(),
  account: vi.fn(),
  serialize: vi.fn(() => 'encrypted-by-vault-later'),
  deserialize: vi.fn(),
}));
vi.mock('@azure/msal-node', async (importOriginal) => {
  const original = await importOriginal<typeof import('@azure/msal-node')>();
  return {
    ...original,
    PublicClientApplication: class {
      constructor(config: unknown) {
        mock.config(config);
      }
      getAuthCodeUrl = mock.url;
      acquireTokenByCode = mock.byCode;
      acquireTokenSilent = mock.silent;
      getTokenCache() {
        return {
          serialize: mock.serialize,
          deserialize: mock.deserialize,
          getAccountByHomeId: mock.account,
        };
      }
    },
  };
});
import { MicrosoftAuth } from '../../src/infrastructure/email/microsoft-auth';

beforeEach(() => {
  vi.clearAllMocks();
  mock.url.mockImplementation(async (request: { redirectUri: string; state: string }) => {
    const url = new URL(
      `https://login.microsoftonline.com/${mailConfigData.tenantId}/oauth2/v2.0/authorize`,
    );
    url.searchParams.set('redirect_uri', request.redirectUri);
    url.searchParams.set('state', request.state);
    return url.href;
  });
  mock.byCode.mockResolvedValue({
    account: {
      tenantId: mailConfigData.tenantId,
      homeAccountId: 'fake-account',
      username: 'qa@example.test',
    },
  });
});
it('utiliza navegador, PKCE S256, tenant concreto y no solicita un client secret', async () => {
  const browser = vi.fn(async (value: string) => {
    const url = new URL(value);
    await fetch(
      `${url.searchParams.get('redirect_uri')}?state=${url.searchParams.get('state')}&code=fake-code`,
    );
  });
  const result = await new MicrosoftAuth(browser).connect(
    mailConfigData,
    new AbortController().signal,
  );
  expect(result).toEqual({
    id: 'fake-account',
    address: 'qa@example.test',
    cache: 'encrypted-by-vault-later',
  });
  const authorize = mock.url.mock.calls[0][0];
  const exchange = mock.byCode.mock.calls[0][0];
  expect(authorize).toMatchObject({
    scopes: ['https://graph.microsoft.com/Mail.Read'],
    codeChallengeMethod: 'S256',
    prompt: 'select_account',
  });
  expect(exchange.code).toBe('fake-code');
  expect(createHash('sha256').update(exchange.codeVerifier).digest('base64url')).toBe(
    authorize.codeChallenge,
  );
  expect(authorize.state.length).toBeGreaterThanOrEqual(32);
  expect(mock.config.mock.calls[0][0].auth).toEqual({
    clientId: mailConfigData.clientId,
    authority: `https://login.microsoftonline.com/${mailConfigData.tenantId}`,
  });
});
it('no abre URLs ajenas a Microsoft', async () => {
  mock.url.mockResolvedValue('https://evil.test');
  const browser = vi.fn();
  await expect(
    new MicrosoftAuth(browser).connect(mailConfigData, new AbortController().signal),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  expect(browser).not.toHaveBeenCalled();
});
it('renueva silenciosamente desde caché y requiere login si no encuentra la cuenta', async () => {
  const adapter = new MicrosoftAuth(vi.fn());
  mock.account.mockResolvedValue({ homeAccountId: 'fake-account' });
  mock.silent.mockResolvedValue({ accessToken: 'fake-token' });
  const result = await adapter.token(
    mailConfigData,
    mailState.account!,
    new AbortController().signal,
  );
  expect(result).toEqual({ accessToken: 'fake-token', cache: 'encrypted-by-vault-later' });
  expect(mock.deserialize).toHaveBeenCalledWith(mailState.account?.cache);
  mock.account.mockResolvedValue(null);
  await expect(
    adapter.token(mailConfigData, mailState.account!, new AbortController().signal),
  ).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
});
