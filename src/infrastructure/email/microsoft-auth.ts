import { createHash, randomBytes } from 'node:crypto';
import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-node';
import type { MailAuth } from '../../application/email/ports';
import type { MailConfig } from '../../domain/email';
import { AppError } from '../../domain/validation';
import { authorizationListener } from './loopback';

const scopes = ['https://graph.microsoft.com/Mail.Read'];
const createClient = (config: MailConfig) =>
  new PublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
    },
    system: { loggerOptions: { piiLoggingEnabled: false, loggerCallback: () => undefined } },
  });
function authError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const code =
    error && typeof error === 'object' && 'errorCode' in error ? String(error.errorCode) : '';
  if (
    error instanceof InteractionRequiredAuthError ||
    ['invalid_grant', 'interaction_required', 'consent_required', 'login_required'].includes(code)
  )
    return new AppError(
      'AUTH_REQUIRED',
      'La sesión de Microsoft expiró o requiere autorización. Vuelve a conectar la cuenta.',
    );
  if (['invalid_client', 'unauthorized_client', 'invalid_resource', 'access_denied'].includes(code))
    return new AppError(
      'AUTH_REQUIRED',
      'Microsoft rechazó el registro o sus permisos. Revisa el client ID, tenant ID y permiso delegado Mail.Read con TI.',
    );
  return new AppError(
    'NETWORK',
    'No se pudo completar el acceso a Microsoft. Revisa la conexión, el registro de Entra y las políticas de tu institución.',
  );
}
export class MicrosoftAuth implements MailAuth {
  constructor(private openBrowser: (url: string) => Promise<void>) {}
  async connect(config: MailConfig, signal: AbortSignal) {
    const client = createClient(config);
    const state = randomBytes(32).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const listener = await authorizationListener(state, signal);
    try {
      const url = await client.getAuthCodeUrl({
        scopes,
        redirectUri: listener.redirectUri,
        codeChallenge: challenge,
        codeChallengeMethod: 'S256',
        state,
        prompt: 'select_account',
        responseMode: 'query',
      });
      if (signal.aborted) throw new AppError('CANCELLED', 'Inicio de sesión cancelado.');
      const parsed = new URL(url);
      if (
        parsed.origin !== 'https://login.microsoftonline.com' ||
        !parsed.pathname.startsWith(`/${config.tenantId}/`)
      )
        throw new AppError('FORBIDDEN', 'Microsoft devolvió una dirección de acceso no permitida.');
      await this.openBrowser(url);
      const code = await listener.code;
      const result = await client.acquireTokenByCode({
        scopes,
        redirectUri: listener.redirectUri,
        code,
        codeVerifier: verifier,
      });
      if (!result?.account || result.account.tenantId.toLowerCase() !== config.tenantId)
        throw new AppError('AUTH_REQUIRED', 'La cuenta no pertenece al tenant configurado.');
      if (signal.aborted) throw new AppError('CANCELLED', 'Inicio de sesión cancelado.');
      return {
        id: result.account.homeAccountId,
        address: result.account.username,
        cache: client.getTokenCache().serialize(),
      };
    } catch (error) {
      throw authError(error);
    } finally {
      listener.close();
    }
  }
  async token(config: MailConfig, account: Parameters<MailAuth['token']>[1], signal: AbortSignal) {
    try {
      if (signal.aborted) throw new AppError('CANCELLED', 'Sincronización cancelada.');
      const client = createClient(config);
      client.getTokenCache().deserialize(account.cache);
      const cached = await client.getTokenCache().getAccountByHomeId(account.id);
      if (!cached)
        throw new AppError('AUTH_REQUIRED', 'Vuelve a conectar tu cuenta para renovar la sesión.');
      const result = await client.acquireTokenSilent({ scopes, account: cached });
      if (signal.aborted) throw new AppError('CANCELLED', 'Sincronización cancelada.');
      return { accessToken: result.accessToken, cache: client.getTokenCache().serialize() };
    } catch (error) {
      throw authError(error);
    }
  }
}
