import { oauthMetadata } from '@/lib/task-portal-oauth';

export const runtime = 'nodejs';
export function GET() {
  return Response.json(oauthMetadata(), { headers: { 'Cache-Control': 'no-store' } });
}
