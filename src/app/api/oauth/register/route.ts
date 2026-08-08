import { registerOAuthClient } from '@/lib/task-portal-oauth';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const body = await request.json() as { redirect_uris?: unknown };
    return Response.json(await registerOAuthClient(body.redirect_uris), { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Registrazione non valida.' }, { status: 400 });
  }
}
