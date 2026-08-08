import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import { createTaskPortalMcpServer } from '@/lib/task-portal-mcp';
import { isOAuthAccessToken, mcpUnauthorizedResponse } from '@/lib/task-portal-oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: Request) {
  if (!isOAuthAccessToken(request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null)) {
    return mcpUnauthorizedResponse();
  }
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  const server = createTaskPortalMcpServer();
  await server.connect(transport);
  return transport.handleRequest(request);
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
