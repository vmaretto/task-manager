import { isApprovalSecret, issueAuthorizationCode } from '@/lib/task-portal-oauth';

export const runtime = 'nodejs';

function page(error = '') {
  return '<!doctype html><html lang=\"it\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Autorizza Task Portal</title><body style=\"font-family:system-ui;max-width:540px;margin:10vh auto;padding:24px\"><h1>Task Portal</h1><p>Autorizza ChatGPT a leggere progetti e creare task per Virgilio.</p>' + (error ? '<p style=\"color:#b42318\">' + error + '</p>' : '') + '<form method=\"post\"><input type=\"password\" name=\"approval_secret\" placeholder=\"Codice di autorizzazione\" required autofocus style=\"width:100%;box-sizing:border-box;padding:12px\"><input type=\"hidden\" name=\"client_id\" value=\"__CLIENT_ID__\"><input type=\"hidden\" name=\"redirect_uri\" value=\"__REDIRECT_URI__\"><input type=\"hidden\" name=\"state\" value=\"__STATE__\"><input type=\"hidden\" name=\"code_challenge\" value=\"__CHALLENGE__\"><button style=\"margin-top:16px;padding:12px 16px\">Autorizza</button></form></body></html>';
}

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderPage({ clientId, redirectUri, state, challenge }: { clientId: string; redirectUri: string; state: string; challenge: string }, error = '') {
  return page(error)
    .replace('__CLIENT_ID__', escapeAttribute(clientId))
    .replace('__REDIRECT_URI__', escapeAttribute(redirectUri))
    .replace('__STATE__', escapeAttribute(state))
    .replace('__CHALLENGE__', escapeAttribute(challenge));
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const clientId = params.get('client_id') ?? '';
  const redirectUri = params.get('redirect_uri') ?? '';
  const challenge = params.get('code_challenge') ?? '';
  if (!clientId || !redirectUri || !challenge) return new Response('Richiesta OAuth incompleta.', { status: 400 });
  return new Response(renderPage({ clientId, redirectUri, state: params.get('state') ?? '', challenge }), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const secret = form.get('approval_secret');
  const clientId = String(form.get('client_id') ?? '');
  const redirectUri = String(form.get('redirect_uri') ?? '');
  const challenge = String(form.get('code_challenge') ?? '');
  const state = String(form.get('state') ?? '');
  if (!isApprovalSecret(typeof secret === 'string' ? secret : null)) return new Response(renderPage({ clientId, redirectUri, state, challenge }, 'Codice non valido.'), { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  try {
    const code = await issueAuthorizationCode(clientId, redirectUri, challenge);
    const destination = new URL(redirectUri);
    destination.searchParams.set('code', code);
    if (state) destination.searchParams.set('state', state);
    return Response.redirect(destination, 302);
  } catch (error) {
    return new Response(renderPage({ clientId, redirectUri, state, challenge }, error instanceof Error ? error.message : 'Autorizzazione non disponibile.'), { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}
