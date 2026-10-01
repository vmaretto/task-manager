import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import { createTaskPortalMcpServer } from '@/lib/task-portal-mcp';
import { canWrite } from '@/lib/oauth-scope';
import { mcpUnauthorizedResponse, readOAuthAccessToken } from '@/lib/task-portal-oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: Request) {
  const token = readOAuthAccessToken(request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null);
  if (!token) {
    return mcpUnauthorizedResponse();
  }
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  const server = createTaskPortalMcpServer({ canWrite: canWrite(token.scope) });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
