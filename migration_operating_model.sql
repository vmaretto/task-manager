-- Allinea installazioni esistenti al modello operativo unico:
-- Area -> Progetto/filone -> Task, con quattro macro-aree canoniche.
-- Idempotente: puo essere eseguita piu volte nel SQL Editor di Supabase.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS parent_project_id UUID
  REFERENCES projects(id)
  ON DELETE SET NULL;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS is_area BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS projects_parent_project_id_idx
  ON projects(parent_project_id);

-- Promuove eventuali record gia esistenti, mantenendo gli ID e quindi tutti i
-- collegamenti dei progetti figli.
UPDATE projects
SET is_area = true,
    parent_project_id = NULL,
    status = CASE WHEN status = 'done' THEN 'active' ELSE status END
WHERE lower(btrim(name)) IN (
  'professionista',
  'posti',
  'fib',
  'food innovation broker',
  'personale'
);

INSERT INTO projects (name, status, color, emoji, description, parent_project_id, is_area, sort_order)
SELECT 'Professionista', 'active', '#8b5cf6', '👤',
       'Incarichi, docenze, consulenze e attivita professionali personali',
       NULL, true, 0
WHERE NOT EXISTS (
  SELECT 1 FROM projects WHERE lower(btrim(name)) = 'professionista'
);

INSERT INTO projects (name, status, color, emoji, description, parent_project_id, is_area, sort_order)
SELECT 'pOsti', 'active', '#2563eb', '⛓️',
       'Piattaforma, progetti, clienti e attivita collegate a pOsti',
       NULL, true, 1
WHERE NOT EXISTS (
  SELECT 1 FROM projects WHERE lower(btrim(name)) = 'posti'
);

INSERT INTO projects (name, status, color, emoji, description, parent_project_id, is_area, sort_order)
SELECT 'Food Innovation Broker', 'active', '#ef4444', '📊',
       'Iniziative, amministrazione e sviluppo Food Innovation Broker',
       NULL, true, 2
WHERE NOT EXISTS (
  SELECT 1 FROM projects
  WHERE lower(btrim(name)) IN ('fib', 'food innovation broker')
);

INSERT INTO projects (name, status, color, emoji, description, parent_project_id, is_area, sort_order)
SELECT 'Personale', 'active', '#10b981', '🌱',
       'Casa, salute, famiglia e attivita non lavorative',
       NULL, true, 3
WHERE NOT EXISTS (
  SELECT 1 FROM projects WHERE lower(btrim(name)) = 'personale'
);

-- Stabilizza l'ordine delle quattro aree senza rinominare alias gia in uso.
UPDATE projects SET sort_order = 0 WHERE is_area AND lower(btrim(name)) = 'professionista';
UPDATE projects SET sort_order = 1 WHERE is_area AND lower(btrim(name)) = 'posti';
UPDATE projects SET sort_order = 2 WHERE is_area AND lower(btrim(name)) IN ('fib', 'food innovation broker');
UPDATE projects SET sort_order = 3 WHERE is_area AND lower(btrim(name)) = 'personale';

