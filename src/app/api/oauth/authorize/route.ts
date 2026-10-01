import { canWrite, normalizeScope } from '@/lib/oauth-scope';
import { isApprovalSecret, issueAuthorizationCode } from '@/lib/task-portal-oauth';

export const runtime = 'nodejs';

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function hostOf(url: string) {
  try { return new URL(url).host; } catch { return url; }
}

type Request_ = { clientId: string; redirectUri: string; state: string; challenge: string; scope: string };

// The page states who is asking and exactly what the code will allow, from the scope actually
// requested: a read-only request must not read as "create tasks".
function renderPage({ clientId, redirectUri, state, challenge, scope }: Request_, error = '') {
  const write = canWrite(scope);
  const permissions = write
    ? '<li>leggere aree, progetti e task</li><li><strong>creare, modificare, spostare e chiudere task</strong></li>'
    : '<li>leggere aree, progetti e task</li><li><strong>sola lettura</strong>: non potrà creare né modificare niente</li>';
  return '<!doctype html><html lang="it"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Autorizza Task Portal</title>'
    + '<body style="font-family:system-ui;max-width:540px;margin:10vh auto;padding:24px"><h1>Task Portal</h1>'
    + '<p>Un\'applicazione chiede di accedere al Task Portal di Virgilio.</p>'
    + '<p style="color:#555">Richiesta da: <strong>' + escapeAttribute(hostOf(redirectUri)) + '</strong><br><span style="font-size:12px">client ' + escapeAttribute(clientId.slice(0, 80)) + '</span></p>'
    + '<p>Potrà:</p><ul>' + permissions + '</ul>'
    + '<p style="font-size:12px;color:#555">Permessi richiesti: ' + escapeAttribute(scope) + '. Il token vale 30 giorni.</p>'
    + (error ? '<p style="color:#b42318">' + escapeAttribute(error) + '</p>' : '')
    + '<form method="post"><input type="password" name="approval_secret" placeholder="Codice di autorizzazione" required autofocus style="width:100%;box-sizing:border-box;padding:12px">'
    + '<input type="hidden" name="client_id" value="' + escapeAttribute(clientId) + '">'
    + '<input type="hidden" name="redirect_uri" value="' + escapeAttribute(redirectUri) + '">'
    + '<input type="hidden" name="state" value="' + escapeAttribute(state) + '">'
    + '<input type="hidden" name="code_challenge" value="' + escapeAttribute(challenge) + '">'
    + '<input type="hidden" name="scope" value="' + escapeAttribute(scope) + '">'
    + '<button style="margin-top:16px;padding:12px 16px">Autorizza</button></form></body></html>';
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const clientId = params.get('client_id') ?? '';
  const redirectUri = params.get('redirect_uri') ?? '';
  const challenge = params.get('code_challenge') ?? '';
  if (!clientId || !redirectUri || !challenge) return new Response('Richiesta OAuth incompleta.', { status: 400 });
  const scope = normalizeScope(params.get('scope'));
  return new Response(renderPage({ clientId, redirectUri, state: params.get('state') ?? '', challenge, scope }), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const secret = form.get('approval_secret');
  const clientId = String(form.get('client_id') ?? '');
  const redirectUri = String(form.get('redirect_uri') ?? '');
  const challenge = String(form.get('code_challenge') ?? '');
  const state = String(form.get('state') ?? '');
  const scope = normalizeScope(String(form.get('scope') ?? ''));
  if (!isApprovalSecret(typeof secret === 'string' ? secret : null)) return new Response(renderPage({ clientId, redirectUri, state, challenge, scope }, 'Codice non valido.'), { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  try {
    const code = await issueAuthorizationCode(clientId, redirectUri, challenge, scope);
    const destination = new URL(redirectUri);
    destination.searchParams.set('code', code);
    if (state) destination.searchParams.set('state', state);
    return Response.redirect(destination, 302);
  } catch (error) {
    return new Response(renderPage({ clientId, redirectUri, state, challenge, scope }, error instanceof Error ? error.message : 'Autorizzazione non disponibile.'), { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}
