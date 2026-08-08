import { exchangeAuthorizationCode } from '@/lib/task-portal-oauth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const form = await request.formData();
  try {
    const accessToken = await exchangeAuthorizationCode(
      String(form.get('code') ?? ''),
      String(form.get('client_id') ?? ''),
      String(form.get('redirect_uri') ?? ''),
      String(form.get('code_verifier') ?? ''),
    );
    return Response.json({ access_token: accessToken, token_type: 'Bearer', expires_in: 2592000, scope: 'tasks:read tasks:write' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: 'invalid_grant', error_description: error instanceof Error ? error.message : 'Codice OAuth non valido.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
}
