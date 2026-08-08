import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { getVoiceServerClient } from '@/lib/voice-task-server';

const origin = 'https://task-manager-dusky-chi-88.vercel.app';
const resource = origin + '/api/mcp';

function digest(value: string) {
  return createHash('sha256').update(value).digest('base64url');
}

function signingSecret() {
  const value = process.env.MCP_OAUTH_SIGNING_SECRET;
  if (!value || value.length < 32) throw new Error('OAuth non configurato.');
  return value;
}

export function oauthMetadata() {
  return {
    issuer: origin,
    authorization_endpoint: origin + '/api/oauth/authorize',
    token_endpoint: origin + '/api/oauth/token',
    registration_endpoint: origin + '/api/oauth/register',
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  };
}

export function resourceMetadata() {
  return {
    resource,
    authorization_servers: [origin],
    scopes_supported: ['tasks:read', 'tasks:write'],
  };
}

export function mcpUnauthorizedResponse() {
  return new Response(JSON.stringify({ error: 'Autorizzazione MCP richiesta.' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'WWW-Authenticate': 'Bearer resource_metadata="' + origin + '/.well-known/oauth-protected-resource", scope="tasks:read tasks:write"',
    },
  });
}

export function isApprovalSecret(value: string | null) {
  const expected = process.env.MCP_OAUTH_APPROVAL_SECRET;
  if (!value || !expected || expected.length < 24) return false;
  return timingSafeEqual(createHash('sha256').update(value).digest(), createHash('sha256').update(expected).digest());
}

export async function registerOAuthClient(redirectUris: unknown) {
  if (!Array.isArray(redirectUris) || redirectUris.length === 0 || redirectUris.some(item => typeof item !== 'string' || !item.startsWith('https://'))) throw new Error('redirect_uris non valido.');
  const clientId = 'mtp_client_' + randomBytes(18).toString('base64url');
  const { error } = await getVoiceServerClient().from('mcp_oauth_clients').insert({ client_id: clientId, redirect_uris: redirectUris });
  if (error) throw new Error('Registrazione OAuth non disponibile.');
  return { client_id: clientId, redirect_uris: redirectUris, token_endpoint_auth_method: 'none' };
}

export async function issueAuthorizationCode(clientId: string, redirectUri: string, challenge: string) {
  const supabase = getVoiceServerClient();
  const { data: client } = await supabase.from('mcp_oauth_clients').select('redirect_uris').eq('client_id', clientId).maybeSingle();
  if (!client || !Array.isArray(client.redirect_uris) || !client.redirect_uris.includes(redirectUri)) throw new Error('Client OAuth non valido.');
  const code = 'mtc_' + randomBytes(32).toString('base64url');
  const { error } = await supabase.from('mcp_oauth_codes').insert({ code_hash: digest(code), client_id: clientId, redirect_uri: redirectUri, code_challenge: challenge, expires_at: new Date(Date.now() + 300000).toISOString() });
  if (error) throw new Error('Non riesco a creare l’autorizzazione.');
  return code;
}

export async function exchangeAuthorizationCode(code: string, clientId: string, redirectUri: string, verifier: string) {
  const supabase = getVoiceServerClient();
  const { data } = await supabase.from('mcp_oauth_codes').select('*').eq('code_hash', digest(code)).maybeSingle();
  if (!data || data.used_at || data.client_id !== clientId || data.redirect_uri !== redirectUri || data.code_challenge !== digest(verifier) || new Date(data.expires_at).getTime() < Date.now()) throw new Error('Codice OAuth non valido.');
  const { data: used } = await supabase.from('mcp_oauth_codes').update({ used_at: new Date().toISOString() }).eq('id', data.id).is('used_at', null).select('id').maybeSingle();
  if (!used) throw new Error('Codice OAuth già usato.');
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: origin, aud: resource, sub: 'virgilio', scope: 'tasks:read tasks:write', iat: now, exp: now + 2592000 })).toString('base64url');
  const signature = createHmac('sha256', signingSecret()).update(header + '.' + payload).digest('base64url');
  return header + '.' + payload + '.' + signature;
}

export function isOAuthAccessToken(value: string | null) {
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  const expected = createHmac('sha256', signingSecret()).update(parts[0] + '.' + parts[1]).digest('base64url');
  if (!timingSafeEqual(Buffer.from(parts[2]), Buffer.from(expected))) return false;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { iss?: string; aud?: string; exp?: number };
    return claims.iss === origin && claims.aud === resource && typeof claims.exp === 'number' && claims.exp * 1000 > Date.now();
  } catch { return false; }
}
