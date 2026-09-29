import { expect, it, vi } from 'vitest';
import {
  graphUrl,
  MicrosoftGraph,
  parseChange,
  retryDelay,
} from '../../src/infrastructure/email/microsoft-graph';

const cursor =
  'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=fake';
const ok = () =>
  new Response(
    JSON.stringify({
      value: [{ id: 'fake', subject: 'Hola', receivedDateTime: '2026-09-29T10:00:00Z' }],
      '@odata.deltaLink': cursor,
    }),
  );
it.each([
  'https://evil.test/v1.0/me/mailFolders/inbox/messages/delta',
  'https://graph.microsoft.com.evil.test/v1.0/me/mailFolders/inbox/messages/delta',
  'http://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta',
  'https://graph.microsoft.com/v1.0/me/drive',
  'https://user@graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta',
])('rechaza URL fuera de la lista permitida: %s', (url) => expect(() => graphUrl(url)).toThrow());
it('solicita campos mínimos, sigue delta y no permite redirects', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(ok());
  const provider = new MicrosoftGraph(fetcher);
  const result = await provider.page(
    'fake-token',
    null,
    '2026-08-30T00:00:00Z',
    new AbortController().signal,
  );
  const [url, init] = fetcher.mock.calls[0];
  const parsed = new URL(String(url));
  expect(parsed.searchParams.get('$select')).toContain('bodyPreview');
  expect(parsed.searchParams.get('$select')).not.toContain('attachments');
  expect(parsed.searchParams.get('$filter')).toBe('receivedDateTime ge 2026-08-30T00:00:00Z');
  expect(init?.redirect).toBe('error');
  expect(result).toMatchObject({ cursor, hasMore: false });
  fetcher.mockResolvedValue(ok());
  await provider.page('fake-token', result.cursor, '', new AbortController().signal);
  expect(fetcher.mock.calls[1][0]).toBe(cursor);
});
it('respeta Retry-After y no reintenta antes de un límite largo', async () => {
  const sleep = vi.fn(async () => undefined);
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '2' } }))
    .mockResolvedValueOnce(ok());
  await new MicrosoftGraph(fetcher, sleep).page('fake', null, '', new AbortController().signal);
  expect(sleep).toHaveBeenCalledWith(2000, expect.any(AbortSignal));
  fetcher.mockResolvedValue(new Response('', { status: 429, headers: { 'Retry-After': '120' } }));
  await expect(
    new MicrosoftGraph(fetcher, sleep).page('fake', null, '', new AbortController().signal),
  ).rejects.toMatchObject({ code: 'RATE_LIMIT' });
  expect(sleep).toHaveBeenCalledTimes(1);
  expect(retryDelay('Tue, 29 Sep 2026 15:00:05 GMT', 0, Date.parse('2026-09-29T15:00:00Z'))).toBe(
    5000,
  );
});
it.each([
  [401, 'AUTH_REQUIRED'],
  [403, 'AUTH_REQUIRED'],
  [410, 'SYNC_RESET'],
  [400, 'NETWORK'],
] as const)('traduce HTTP %s sin exponer el contenido remoto', async (status, code) => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response('sensitive-error-detail', { status }));
  await expect(
    new MicrosoftGraph(fetcher).page('fake', null, '', new AbortController().signal),
  ).rejects.toMatchObject({ code });
});
it('procesa eliminaciones y parches parciales sin inventar contenido', () => {
  expect(parseChange({ id: 'fake', '@removed': { reason: 'deleted' } })).toEqual({
    providerId: 'fake',
    deleted: true,
  });
  expect(parseChange({ id: 'fake', isRead: true })).toEqual({
    providerId: 'fake',
    deleted: false,
    data: { isRead: true },
  });
  expect(() => parseChange({ id: 'fake', receivedDateTime: 'invalid' })).toThrow();
});
it('rechaza cursor remoto malicioso antes de guardar correos', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(JSON.stringify({ value: [], '@odata.nextLink': 'https://evil.test' })),
    );
  await expect(
    new MicrosoftGraph(fetcher).page('fake', null, '', new AbortController().signal),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
});

it('mantiene un Retry-After largo entre ejecuciones sin repetir la petición', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response('', { status: 429, headers: { 'Retry-After': '600' } }));
  const provider = new MicrosoftGraph(fetcher);
  await expect(provider.page('fake', null, '', new AbortController().signal)).rejects.toMatchObject(
    { code: 'RATE_LIMIT' },
  );
  await expect(provider.page('fake', null, '', new AbortController().signal)).rejects.toMatchObject(
    { code: 'RATE_LIMIT' },
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
});
