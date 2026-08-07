-- Abbinamento monouso per configurare il task vocale senza esporre segreti
-- amministrativi al browser. Idempotente e da applicare dopo migration_voice_tasks.sql.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS voice_task_pairings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_profile TEXT NOT NULL CHECK (owner_profile IN ('virgilio', 'marco', 'ida')),
  code_hash TEXT NOT NULL UNIQUE,
  code_prefix TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS voice_task_pairings_profile_created_idx
  ON voice_task_pairings(owner_profile, created_at DESC);
CREATE INDEX IF NOT EXISTS voice_task_pairings_unused_expiry_idx
  ON voice_task_pairings(expires_at)
  WHERE used_at IS NULL;

ALTER TABLE voice_task_pairings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE voice_task_pairings FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION exchange_voice_task_pairing(
  pairing_hash_value TEXT,
  new_token_hash_value TEXT,
  new_token_prefix_value TEXT
)
RETURNS TABLE(owner_profile TEXT, token_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pairing_profile TEXT;
  created_token_id UUID;
BEGIN
  SELECT pairing.owner_profile
  INTO pairing_profile
  FROM voice_task_pairings AS pairing
  WHERE pairing.code_hash = pairing_hash_value
    AND pairing.used_at IS NULL
    AND pairing.expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('voice-task-token:' || pairing_profile));

  UPDATE voice_task_tokens
  SET revoked_at = NOW()
  WHERE voice_task_tokens.owner_profile = pairing_profile
    AND revoked_at IS NULL;

  INSERT INTO voice_task_tokens (owner_profile, token_hash, token_prefix)
  VALUES (pairing_profile, new_token_hash_value, new_token_prefix_value)
  RETURNING id INTO created_token_id;

  UPDATE voice_task_pairings
  SET used_at = NOW()
  WHERE code_hash = pairing_hash_value;

  RETURN QUERY SELECT pairing_profile, created_token_id;
END;
$$;

REVOKE ALL ON FUNCTION exchange_voice_task_pairing(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION exchange_voice_task_pairing(TEXT, TEXT, TEXT) TO service_role;

-- Comando amministrativo utilizzabile dal SQL Editor Supabase. Restituisce il
-- codice in chiaro una sola volta; anon e utenti applicativi non possono chiamarlo.
CREATE OR REPLACE FUNCTION create_voice_task_pairing(profile_name TEXT)
RETURNS TABLE(pairing_code TEXT, expires_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  alphabet CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  entropy BYTEA := extensions.gen_random_bytes(20);
  symbols TEXT := '';
  generated_code TEXT;
  generated_expiry TIMESTAMP WITH TIME ZONE := NOW() + INTERVAL '15 minutes';
  symbol_index INTEGER;
BEGIN
  IF profile_name NOT IN ('virgilio', 'marco', 'ida') THEN
    RAISE EXCEPTION 'Profilo vocale non valido.' USING ERRCODE = '22023';
  END IF;

  FOR symbol_index IN 0..19 LOOP
    symbols := symbols || substr(alphabet, (get_byte(entropy, symbol_index) % 32) + 1, 1);
  END LOOP;
  generated_code := 'VTP-' || substr(symbols, 1, 4) || '-' || substr(symbols, 5, 4)
    || '-' || substr(symbols, 9, 4) || '-' || substr(symbols, 13, 4)
    || '-' || substr(symbols, 17, 4);

  PERFORM pg_advisory_xact_lock(hashtext('voice-task-pairing:' || profile_name));
  UPDATE voice_task_pairings
  SET used_at = NOW()
  WHERE owner_profile = profile_name AND used_at IS NULL;

  INSERT INTO voice_task_pairings (owner_profile, code_hash, code_prefix, expires_at)
  VALUES (
    profile_name,
    encode(extensions.digest(generated_code, 'sha256'), 'hex'),
    substr(generated_code, 1, 8),
    generated_expiry
  );

  RETURN QUERY SELECT generated_code, generated_expiry;
END;
$$;

REVOKE ALL ON FUNCTION create_voice_task_pairing(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_voice_task_pairing(TEXT) TO service_role;
