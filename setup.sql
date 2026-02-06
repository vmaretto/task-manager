-- Tabella Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'backlog' CHECK (status IN ('backlog', 'active', 'done')),
  color TEXT DEFAULT '#3b82f6',
  emoji TEXT DEFAULT '📁',
  description TEXT DEFAULT ''
);

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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
