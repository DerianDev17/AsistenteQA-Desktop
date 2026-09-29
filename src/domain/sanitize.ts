// Defense in depth: content is also encrypted at rest. No heuristic can identify all secrets.
export function sanitizeMailText(value: string): string {
  return value
    .replace(
      /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi,
      '[KEY_REDACTED]',
    )
    .replace(/\bBearer\s+[\w.\-~+/]+=*/gi, '[TOKEN_REDACTED]')
    .replace(
      /(["']?\b(?:password|contrase(?:ñ|n)a|api[_ -]?key|client[_ -]?secret|access[_ -]?token|refresh[_ -]?token|authorization|pin(?:[_ -]?block)?|zpk|zmk|cvv2?)\b["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      '$1[REDACTED]',
    )
    .replace(/\b(?:\d[ -]?){12,18}\d\b/g, '[CARD_REDACTED]');
}
