import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type VoiceProfile = 'virgilio' | 'marco' | 'ida';

export const voiceProfiles: VoiceProfile[] = ['virgilio', 'marco', 'ida'];

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

export function isAuthorizedAdmin(value: string | null) {
  const expected = process.env.VOICE_TASK_ADMIN_SECRET;
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
