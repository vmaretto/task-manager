-- Introduce aree esplicite per organizzare e spostare i progetti.
-- Eseguire una sola volta nel SQL Editor di Supabase.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS is_area BOOLEAN NOT NULL DEFAULT false;

UPDATE projects
SET is_area = true,
    parent_project_id = NULL
WHERE lower(name) IN ('posti', 'fib');

INSERT INTO projects (name, status, color, emoji, description, parent_project_id, is_area)
SELECT
  'Professionista',
  'active',
  '#8b5cf6',
  '👤',
  'Incarichi, docenze, consulenze e attività professionali personali',
  NULL,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM projects WHERE lower(name) = 'professionista'
);

