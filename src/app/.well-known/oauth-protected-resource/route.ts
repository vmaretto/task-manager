import { resourceMetadata } from '@/lib/task-portal-oauth';

export const runtime = 'nodejs';
export function GET() {
  return Response.json(resourceMetadata(), { headers: { 'Cache-Control': 'no-store' } });
}
