-- Tabella Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'backlog' CHECK (status IN ('backlog', 'active', 'done')),
  color TEXT DEFAULT '#3b82f6',
  emoji TEXT DEFAULT '📁',
  description TEXT DEFAULT '',
  parent_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  is_area BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS parent_project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS projects_parent_project_id_idx ON projects(parent_project_id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_area BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Tabella Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT NOT NULL,
  notes TEXT DEFAULT '',
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  due_date DATE,
  category TEXT DEFAULT 'work' CHECK (category IN ('work', 'admin', 'personal', 'travel')),
  completed BOOLEAN DEFAULT false,
  workflow_status TEXT NOT NULL DEFAULT 'active' CHECK (workflow_status IN ('active', 'waiting')),
  is_today_priority BOOLEAN NOT NULL DEFAULT false,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'voice')),
  remind_at TIMESTAMP WITH TIME ZONE,
  reminder_channel TEXT DEFAULT 'telegram' CHECK (reminder_channel IN ('telegram', 'email')),
  reminder_status TEXT DEFAULT 'pending' CHECK (reminder_status IN ('pending', 'sent', 'skipped')),
  reminded_at TIMESTAMP WITH TIME ZONE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS remind_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS workflow_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_today_priority BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_channel TEXT DEFAULT 'telegram';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_status TEXT DEFAULT 'pending';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

UPDATE tasks
SET is_today_priority = false
WHERE is_today_priority
  AND (completed OR workflow_status <> 'active');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tasks_today_priority_requires_active_check'
      AND conrelid = 'tasks'::regclass
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_today_priority_requires_active_check
      CHECK (NOT is_today_priority OR (NOT completed AND workflow_status = 'active'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION enforce_tasks_today_priority_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  pin_is_new BOOLEAN;
BEGIN
  IF NEW.completed OR NEW.workflow_status <> 'active' THEN
    NEW.is_today_priority := false;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    pin_is_new := NEW.is_today_priority;
  ELSE
    pin_is_new := NEW.is_today_priority AND NOT OLD.is_today_priority;
  END IF;

  IF pin_is_new THEN
    PERFORM pg_advisory_xact_lock(20260807, 1);
    IF (
      SELECT count(*) FROM tasks
      WHERE is_today_priority
        AND NOT completed
        AND workflow_status = 'active'
        AND id <> NEW.id
    ) >= 3 THEN
      RAISE EXCEPTION 'Sono gia fissate 3 priorita di oggi: rimuovine una prima di continuare.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_enforce_today_priority_rules ON tasks;
CREATE TRIGGER tasks_enforce_today_priority_rules
BEFORE INSERT OR UPDATE OF is_today_priority, completed, workflow_status
ON tasks
FOR EACH ROW
EXECUTE FUNCTION enforce_tasks_today_priority_rules();

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

-- Creazione task vocale e pin normale/forzato in un'unica transazione.
CREATE OR REPLACE FUNCTION create_voice_task_with_priority_policy(
  p_text TEXT,
  p_notes TEXT DEFAULT '',
  p_project_id UUID DEFAULT NULL,
  p_priority TEXT DEFAULT 'medium',
  p_due_date DATE DEFAULT NULL,
  p_needs_review BOOLEAN DEFAULT false,
  p_pin_mode TEXT DEFAULT 'none'
)
RETURNS TABLE(
  task_id UUID,
  task_text TEXT,
  is_today_priority BOOLEAN,
  pin_result TEXT,
  replaced_task_id UUID,
  replaced_task_text TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_pin BOOLEAN := p_pin_mode IN ('pin', 'force');
  force_pin BOOLEAN := p_pin_mode = 'force';
  pin_count INTEGER := 0;
  should_pin BOOLEAN := false;
  result_code TEXT := 'not_requested';
  victim_id UUID := NULL;
  victim_text TEXT := NULL;
  created_task_id UUID;
  created_task_text TEXT;
  created_is_pinned BOOLEAN;
  today_rome DATE := (clock_timestamp() AT TIME ZONE 'Europe/Rome')::date;
BEGIN
  IF NULLIF(btrim(p_text), '') IS NULL THEN
    RAISE EXCEPTION 'Il titolo del task vocale è vuoto.' USING ERRCODE = '22023';
  END IF;
  IF p_priority IS NULL OR p_priority NOT IN ('high', 'medium', 'low') THEN
    RAISE EXCEPTION 'Priorità vocale non valida.' USING ERRCODE = '22023';
  END IF;
  IF p_pin_mode IS NULL OR p_pin_mode NOT IN ('none', 'pin', 'force') THEN
    RAISE EXCEPTION 'Modalità di fissaggio non valida.' USING ERRCODE = '22023';
  END IF;

  IF requested_pin THEN
    PERFORM pg_advisory_xact_lock(20260807, 1);
    SELECT count(*) INTO pin_count
    FROM tasks pinned
    WHERE pinned.is_today_priority AND NOT pinned.completed AND pinned.workflow_status = 'active';

    IF pin_count > 3 THEN
      RAISE EXCEPTION 'Stato delle priorità incoerente: risultano più di 3 task fissati.'
        USING ERRCODE = '23514';
    ELSIF pin_count < 3 THEN
      should_pin := true;
      result_code := 'pinned';
    ELSIF NOT force_pin THEN
      result_code := 'full';
    ELSE
      SELECT candidate.id, candidate.text INTO victim_id, victim_text
      FROM tasks candidate
      WHERE candidate.is_today_priority
        AND NOT candidate.completed
        AND candidate.workflow_status = 'active'
      ORDER BY
        CASE candidate.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END DESC,
        CASE
          WHEN candidate.due_date IS NULL THEN 3
          WHEN candidate.due_date < today_rome THEN 0
          WHEN candidate.due_date = today_rome THEN 1
          ELSE 2
        END DESC,
        candidate.due_date DESC NULLS FIRST,
        candidate.created_at ASC,
        candidate.id ASC
      LIMIT 1;

      IF victim_id IS NULL THEN
        RAISE EXCEPTION 'Conflitto durante la sostituzione della priorità di oggi.'
          USING ERRCODE = '40001';
      END IF;

      UPDATE tasks target SET is_today_priority = false
      WHERE target.id = victim_id AND target.is_today_priority;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'La priorità da sostituire è cambiata: riprova il comando.'
          USING ERRCODE = '40001';
      END IF;

      should_pin := true;
      result_code := 'replaced';
    END IF;
  END IF;

  INSERT INTO tasks (
    text, notes, project_id, priority, due_date, category, completed,
    workflow_status, is_today_priority, needs_review, source
  ) VALUES (
    btrim(p_text), COALESCE(p_notes, ''), p_project_id, p_priority, p_due_date,
    'work', false, 'active', should_pin, COALESCE(p_needs_review, false), 'voice'
  )
  RETURNING id, text, tasks.is_today_priority
  INTO created_task_id, created_task_text, created_is_pinned;

  RETURN QUERY SELECT created_task_id, created_task_text, created_is_pinned,
    result_code, victim_id, victim_text;
END;
$$;

REVOKE ALL ON FUNCTION create_voice_task_with_priority_policy(TEXT, TEXT, UUID, TEXT, DATE, BOOLEAN, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_voice_task_with_priority_policy(TEXT, TEXT, UUID, TEXT, DATE, BOOLEAN, TEXT)
  TO service_role;

-- Token personali per Comandi Rapidi. Nessun token in chiaro viene persistito.
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
  ON voice_task_tokens(owner_profile) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS voice_task_tokens_hash_active_idx
  ON voice_task_tokens(token_hash) WHERE revoked_at IS NULL;

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
REVOKE ALL ON TABLE voice_task_tokens FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE voice_task_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION rotate_voice_task_token(profile_name TEXT, new_token_hash TEXT, new_token_prefix TEXT)
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
  UPDATE voice_task_tokens SET revoked_at = NOW()
    WHERE owner_profile = profile_name AND revoked_at IS NULL;
  INSERT INTO voice_task_tokens (owner_profile, token_hash, token_prefix)
    VALUES (profile_name, new_token_hash, new_token_prefix)
    RETURNING id INTO created_id;
  RETURN created_id;
END;
$$;

REVOKE ALL ON FUNCTION rotate_voice_task_token(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rotate_voice_task_token(TEXT, TEXT, TEXT) TO service_role;

-- Codici monouso di abbinamento. Consentono all'utente di ricevere il proprio
-- token senza conoscere o inviare al browser il segreto amministrativo.
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
  ON voice_task_pairings(expires_at) WHERE used_at IS NULL;

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
  SELECT pairing.owner_profile INTO pairing_profile
  FROM voice_task_pairings AS pairing
  WHERE pairing.code_hash = pairing_hash_value
    AND pairing.used_at IS NULL
    AND pairing.expires_at > NOW()
  FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('voice-task-token:' || pairing_profile));
  UPDATE voice_task_tokens SET revoked_at = NOW()
    WHERE voice_task_tokens.owner_profile = pairing_profile AND revoked_at IS NULL;
  INSERT INTO voice_task_tokens (owner_profile, token_hash, token_prefix)
    VALUES (pairing_profile, new_token_hash_value, new_token_prefix_value)
    RETURNING id INTO created_token_id;
  UPDATE voice_task_pairings SET used_at = NOW()
    WHERE code_hash = pairing_hash_value;
  RETURN QUERY SELECT pairing_profile, created_token_id;
END;
$$;

REVOKE ALL ON FUNCTION exchange_voice_task_pairing(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION exchange_voice_task_pairing(TEXT, TEXT, TEXT) TO service_role;

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
  UPDATE voice_task_pairings SET used_at = NOW()
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

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for now - no auth)
CREATE POLICY "Allow all on projects" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);

-- Insert initial projects
INSERT INTO projects (id, name, status, color, emoji, description) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Master Carbon Farming', 'active', '#10b981', '🌱', 'Direttore Operativo - Università della Tuscia'),
  ('22222222-2222-2222-2222-222222222222', 'SWITCH', 'active', '#3b82f6', '🇪🇺', 'Horizon Europe - Food Hub'),
  ('33333333-3333-3333-3333-333333333333', 'POSTI', 'active', '#8b5cf6', '⛓️', 'Piattaforma tracciabilità blockchain'),
  ('44444444-4444-4444-4444-444444444444', 'LIFE Food4Choice', 'active', '#f43f5e', '🍎', 'Progetto EU LIFE - App riconoscimento cibo'),
  ('55555555-5555-5555-5555-555555555555', 'Terra Mia Tolfa', 'active', '#a855f7', '🏡', 'Valorizzazione territoriale Comune di Tolfa'),
  ('66666666-6666-6666-6666-666666666666', 'Consiglio del Cibo Roma', 'active', '#ec4899', '🏛️', 'Membro consiglio'),
  ('77777777-7777-7777-7777-777777777777', 'ITS Docenza', 'active', '#06b6d4', '🎓', 'ITS Firenze + ITS Latina'),
  ('88888888-8888-8888-8888-888888888888', 'Birra Peroni / BEST', 'active', '#eab308', '🍺', 'Manutenzione + evoluzione BEST')
ON CONFLICT (id) DO NOTHING;

-- Insert initial tasks
INSERT INTO tasks (text, notes, project_id, priority, category, completed) VALUES
  ('Convenzione RS Management (Master CF)', 'URGENTE - Da completare prima della conferenza stampa', '11111111-1111-1111-1111-111111111111', 'high', 'work', false),
  ('Conferenza stampa 18/02 — confermare con Nascenzo + INAIL', '', '11111111-1111-1111-1111-111111111111', 'high', 'work', false),
  ('Far inviare inviti dalla mail di Valentini a Porsia e Katia', '', '11111111-1111-1111-1111-111111111111', 'high', 'work', false),
  ('Rispondere alle mail degli studenti', '', '11111111-1111-1111-1111-111111111111', 'medium', 'work', false),
  ('Sentire Cruciani per patrocinio Comune di Roma', '', '11111111-1111-1111-1111-111111111111', 'high', 'work', false),
  ('Sentire Passerini (dopo call Value for Food) per altre partnership Master', '', '11111111-1111-1111-1111-111111111111', 'medium', 'work', false),
  ('Verificare se invitare Sara Roversi (Future Food Institute)', '', '11111111-1111-1111-1111-111111111111', 'medium', 'work', false),
  ('Verificare se invitare presidente/rappresentante Unionfood', '', '11111111-1111-1111-1111-111111111111', 'medium', 'work', false),
  ('Pagare fatture Tolfa', 'Terra Mia', '55555555-5555-5555-5555-555555555555', 'high', 'admin', false),
  ('Firmare documenti LIFE', 'Food4Choice', '44444444-4444-4444-4444-444444444444', 'high', 'work', false),
  ('Fattura CREA + DURC', '', NULL, 'high', 'admin', false),
  ('Invitare Istituto Agrario + Ferraiolo', 'Per conferenza stampa/Master', '11111111-1111-1111-1111-111111111111', 'medium', 'work', false),
  ('Verificare altre aziende Consiglio del Cibo per inviti/partnership', 'Roma', '66666666-6666-6666-6666-666666666666', 'medium', 'work', false),
  ('Sentire Luigi Saviolo per Associanti di Tervo', '', NULL, 'medium', 'work', false),
  ('Patrocinio Comune di Roma', 'Master/CS', '11111111-1111-1111-1111-111111111111', 'high', 'work', false),
  ('Definire meglio il modulo AlleGa', '', '11111111-1111-1111-1111-111111111111', 'medium', 'work', false),
  ('Mandare tracce fatturazione a Value for Food (Passerini)', 'Per il Master', '11111111-1111-1111-1111-111111111111', 'high', 'work', false),
  ('Inviare logo Master Carbon Farming a Value for Food', '', '11111111-1111-1111-1111-111111111111', 'medium', 'work', false),
  ('Partner Master: Barilla', '', '11111111-1111-1111-1111-111111111111', 'medium', 'work', false),
  ('Partner Master: Arsial', '', '11111111-1111-1111-1111-111111111111', 'medium', 'work', false),
  ('Partner Master: Comune Roma', '', '11111111-1111-1111-1111-111111111111', 'medium', 'work', false),
  ('Partner Master: Banca Intesa', '', '11111111-1111-1111-1111-111111111111', 'medium', 'work', false),
  ('Partner Master: Bonifiche Ferraresi', '', '11111111-1111-1111-1111-111111111111', 'medium', 'work', false),
  ('Partner Master: Ferrero', '', '11111111-1111-1111-1111-111111111111', 'medium', 'work', false),
  ('Firmare contratto CREA', '', NULL, 'high', 'work', false)
ON CONFLICT DO NOTHING;
