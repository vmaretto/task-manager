import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type VoiceProfile = 'virgilio' | 'marco' | 'ida';

export const voiceProfiles: VoiceProfile[] = ['virgilio', 'marco', 'ida'];

const PAIRING_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PAIRING_CODE_SYMBOLS = 20;

let serverClient: SupabaseClient | null = null;

export function getVoiceServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error('Configurazione server Supabase incompleta.');

  if (!serverClient) {
    serverClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serverClient;
}

export function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice(7).trim();
  return token || null;
}

export function hashVoiceToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function createVoiceToken() {
  return `vtt_${randomBytes(32).toString('base64url')}`;
}

export function createVoicePairingCode() {
  const bytes = randomBytes(PAIRING_CODE_SYMBOLS);
  const symbols = Array.from(bytes, byte => PAIRING_CODE_ALPHABET[byte % PAIRING_CODE_ALPHABET.length]).join('');
  return `VTP-${symbols.match(/.{1,4}/g)?.join('-')}`;
}

export function normalizeVoicePairingCode(value: string) {
  const compact = value.toUpperCase().replace(/[\s-]/g, '');
  if (!compact.startsWith('VTP')) return null;
  const symbols = compact.slice(3);
  if (symbols.length !== PAIRING_CODE_SYMBOLS) return null;
  if ([...symbols].some(symbol => !PAIRING_CODE_ALPHABET.includes(symbol))) return null;
  return `VTP-${symbols.match(/.{1,4}/g)?.join('-')}`;
}

export function hashVoicePairingCode(code: string) {
  const normalized = normalizeVoicePairingCode(code);
  return normalized ? hashVoiceToken(normalized) : null;
}

export function isAuthorizedAdmin(value: string | null) {
  const expected = process.env.VOICE_TASK_ADMIN_SECRET;
  if (!value || !expected || expected.length < 24) return false;
  const actualDigest = createHash('sha256').update(value, 'utf8').digest();
  const expectedDigest = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

/**
 * Separate secret for the private ChatGPT plugin. It deliberately does not
 * reuse a voice token or the Supabase service-role key.
 */
export function isAuthorizedTaskPortalMcp(value: string | null) {
  const expected = process.env.MCP_TASK_PORTAL_TOKEN;
  if (!value || !expected || expected.length < 24) return false;
  const actualDigest = createHash('sha256').update(value, 'utf8').digest();
  const expectedDigest = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

export function isVoiceProfile(value: unknown): value is VoiceProfile {
  return typeof value === 'string' && voiceProfiles.includes(value as VoiceProfile);
}

export function romeDateKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function noStoreJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { ...init, headers });
}
