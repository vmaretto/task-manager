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
