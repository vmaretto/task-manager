-- OAuth state for the private Task Portal MCP plugin.
create table if not exists public.mcp_oauth_clients (
  client_id text primary key,
  redirect_uris jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.mcp_oauth_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text unique not null,
  client_id text not null references public.mcp_oauth_clients(client_id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mcp_oauth_codes_expiry_idx on public.mcp_oauth_codes(expires_at);
alter table public.mcp_oauth_clients enable row level security;
alter table public.mcp_oauth_codes enable row level security;
revoke all on public.mcp_oauth_clients, public.mcp_oauth_codes from anon, authenticated;
grant all on public.mcp_oauth_clients, public.mcp_oauth_codes to service_role;
