import { exchangeAuthorizationCode, refreshAccessToken } from '@/lib/task-portal-oauth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const form = await request.formData();
  const grantType = String(form.get('grant_type') ?? 'authorization_code');
  try {
    const tokens = grantType === 'refresh_token'
      ? await refreshAccessToken(String(form.get('refresh_token') ?? ''), String(form.get('client_id') ?? ''))
      : await exchangeAuthorizationCode(
        String(form.get('code') ?? ''),
        String(form.get('client_id') ?? ''),
        String(form.get('redirect_uri') ?? ''),
        String(form.get('code_verifier') ?? ''),
      );
    return Response.json({ access_token: tokens.accessToken, token_type: 'Bearer', expires_in: tokens.expiresIn, refresh_token: tokens.refreshToken, scope: tokens.scope }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: 'invalid_grant', error_description: error instanceof Error ? error.message : 'Codice OAuth non valido.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
}
