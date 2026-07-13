-- Aggiunge una gerarchia opzionale tra progetti.
-- Eseguire una sola volta nel SQL Editor di Supabase prima del deploy.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS parent_project_id UUID
  REFERENCES projects(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS projects_parent_project_id_idx
  ON projects(parent_project_id);

