-- Task vocali da Comandi Rapidi (idempotente).
-- Eseguire in Supabase prima di distribuire le route /api/voice-*.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tasks_source_check'
      AND conrelid = 'tasks'::regclass
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_source_check CHECK (source IN ('manual', 'voice'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS voice_task_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_profile TEXT NOT NULL CHECK (owner_profile IN ('virgilio', 'marco', 'ida')),
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX IF NOT EXISTS voice_task_tokens_one_active_per_profile_idx
  ON voice_task_tokens(owner_profile)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS voice_task_tokens_hash_active_idx
  ON voice_task_tokens(token_hash)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS voice_task_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id UUID REFERENCES voice_task_tokens(id) ON DELETE SET NULL,
  owner_profile TEXT NOT NULL CHECK (owner_profile IN ('virgilio', 'marco', 'ida')),
  transcript_preview TEXT NOT NULL,
  parse_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('created', 'needs_review', 'failed')),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS voice_task_events_profile_created_idx
  ON voice_task_events(owner_profile, created_at DESC);
CREATE INDEX IF NOT EXISTS voice_task_events_token_created_idx
  ON voice_task_events(token_id, created_at DESC);

ALTER TABLE voice_task_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_task_events ENABLE ROW LEVEL SECURITY;

-- Nessuna policy pubblica: solo le route server con service role possono leggere
-- hash, ruotare token o consultare l'audit. Il token in chiaro non viene salvato.
REVOKE ALL ON TABLE voice_task_tokens FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE voice_task_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION rotate_voice_task_token(
  profile_name TEXT,
  new_token_hash TEXT,
  new_token_prefix TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created_id UUID;
BEGIN
  IF profile_name NOT IN ('virgilio', 'marco', 'ida') THEN
    RAISE EXCEPTION 'Profilo vocale non valido.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('voice-task-token:' || profile_name));

  UPDATE voice_task_tokens
  SET revoked_at = NOW()
  WHERE owner_profile = profile_name
    AND revoked_at IS NULL;

  INSERT INTO voice_task_tokens (owner_profile, token_hash, token_prefix)
  VALUES (profile_name, new_token_hash, new_token_prefix)
  RETURNING id INTO created_id;

  RETURN created_id;
END;
$$;

REVOKE ALL ON FUNCTION rotate_voice_task_token(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rotate_voice_task_token(TEXT, TEXT, TEXT) TO service_role;
