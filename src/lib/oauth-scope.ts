export const READ_SCOPE = 'tasks:read';
export const WRITE_SCOPE = 'tasks:write';
export const FULL_SCOPE = READ_SCOPE + ' ' + WRITE_SCOPE;

// Without an explicit scope the client gets full access, as before the scopes were enforced
// (claude.ai and ChatGPT connectors already in use rely on it). An explicit scope is honoured:
// unknown values are dropped, write always implies read, and a request with no known
// scope falls back to read-only rather than to write.
export function normalizeScope(requested: string | null | undefined) {
  const raw = (requested ?? '').trim();
  if (!raw) return FULL_SCOPE;
  const asked = new Set(raw.split(/\s+/));
  return asked.has(WRITE_SCOPE) ? FULL_SCOPE : READ_SCOPE;
}

export function canWrite(scope: string | null | undefined) {
  return (scope ?? '').split(/\s+/).includes(WRITE_SCOPE);
}
