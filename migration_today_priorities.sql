-- Dashboard "Priorita di oggi" and safe initial task seed.
-- Run once in the Supabase SQL editor. The statements are idempotent:
-- existing tasks are never reopened and an already known task (even completed)
-- prevents creation of a duplicate open item.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS workflow_status TEXT NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_workflow_status_check'
      AND conrelid = 'tasks'::regclass
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_workflow_status_check
      CHECK (workflow_status IN ('active', 'waiting'));
  END IF;
END $$;

INSERT INTO projects (id, name, status, color, emoji, description, sort_order)
SELECT seed.id, seed.name, 'active', seed.color, seed.emoji, seed.description, seed.sort_order
FROM (VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'Coach', '#f97316', '🤝', 'Sessioni di coaching', 40),
  ('aaaaaaaa-0000-4000-8000-000000000002'::uuid, 'FIB', '#ef4444', '🏦', 'Amministrazione FIB', 41),
  ('aaaaaaaa-0000-4000-8000-000000000003'::uuid, 'GAL', '#22c55e', '🧾', 'Fatturazione GAL', 42),
  ('aaaaaaaa-0000-4000-8000-000000000004'::uuid, 'WISE', '#06b6d4', '🔗', 'Integrazione dati e interfacce', 43),
  ('88888888-8888-8888-8888-888888888888'::uuid, 'Birra Peroni / BEST', '#eab308', '🍺', 'Manutenzione ed evoluzione BEST', 44),
  ('aaaaaaaa-0000-4000-8000-000000000005'::uuid, 'Nastro Azzurro', '#3b82f6', '🔵', 'Coordinamento Nastro Azzurro', 45),
  ('aaaaaaaa-0000-4000-8000-000000000006'::uuid, 'Scanner', '#64748b', '📦', 'Logistica scanner', 46),
  ('aaaaaaaa-0000-4000-8000-000000000007'::uuid, 'EFL', '#8b5cf6', '📊', 'Indicatori e caricamenti', 47),
  ('aaaaaaaa-0000-4000-8000-000000000008'::uuid, 'VFF', '#ec4899', '📅', 'Coordinamento Value for Food', 48)
) AS seed(id, name, color, emoji, description, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM projects existing WHERE lower(existing.name) = lower(seed.name)
)
ON CONFLICT (id) DO NOTHING;

WITH seeds(id, text, notes, project_name, priority, due_date, workflow_status, sort_order) AS (
  VALUES
    ('bbbbbbbb-0000-4000-8000-000000000001'::uuid, 'Rieseguire o verificare bonifico Coach (€400)', 'Bonifico per 5 sessioni tentato e rifiutato.', 'Coach', 'high', CURRENT_DATE, 'active', 0),
    ('bbbbbbbb-0000-4000-8000-000000000002'::uuid, 'Rieseguire o verificare il terzo bonifico FIB', 'Due bonifici utili netti risultano eseguiti; il terzo è stato rifiutato.', 'FIB', 'high', CURRENT_DATE, 'active', 1),
    ('bbbbbbbb-0000-4000-8000-000000000003'::uuid, 'Verificare emissione e invio della prima fattura GAL', 'I dati necessari sono già stati inviati.', 'GAL', 'high', CURRENT_DATE, 'active', 2),
    ('bbbbbbbb-0000-4000-8000-000000000004'::uuid, 'Riprendere integrazione dati e interfacce WISE con Giuseppe', '[[responsabile:Virgilio + Giuseppe]]', 'WISE', 'medium', CURRENT_DATE + 1, 'active', 3),
    ('bbbbbbbb-0000-4000-8000-000000000005'::uuid, 'Chiarire suddivisione e invio file Peroni', 'Ripresa prevista dal 25 agosto.', 'Birra Peroni / BEST', 'medium', DATE '2026-08-25', 'waiting', 4),
    ('bbbbbbbb-0000-4000-8000-000000000006'::uuid, 'Ottenere conferma e fissare allineamento Nastro Azzurro', 'In attesa di conferma.', 'Nastro Azzurro', 'medium', NULL::date, 'waiting', 5),
    ('bbbbbbbb-0000-4000-8000-000000000007'::uuid, 'Confermare destinazione e spedizione scanner', '', 'Scanner', 'medium', CURRENT_DATE + 2, 'active', 6),
    ('bbbbbbbb-0000-4000-8000-000000000008'::uuid, 'Allineare gli indicatori e provare il caricamento massivo EFL', '', 'EFL', 'high', CURRENT_DATE + 3, 'active', 7),
    ('bbbbbbbb-0000-4000-8000-000000000009'::uuid, 'Chiudere accordo Confagricoltura e correggere le presenze', '', 'Master Carbon Farming', 'high', CURRENT_DATE + 4, 'active', 8),
    ('bbbbbbbb-0000-4000-8000-000000000010'::uuid, 'Preparare e rispondere alla riunione VFF dell’8 settembre', '', 'VFF', 'medium', DATE '2026-09-08', 'active', 9)
)
INSERT INTO tasks (
  id, text, notes, project_id, priority, due_date, category, completed,
  workflow_status, reminder_channel, reminder_status, sort_order
)
SELECT
  seed.id,
  seed.text,
  seed.notes,
  (SELECT project.id FROM projects project WHERE lower(project.name) = lower(seed.project_name) ORDER BY project.id LIMIT 1),
  seed.priority,
  seed.due_date,
  'work',
  false,
  seed.workflow_status,
  'telegram',
  'pending',
  seed.sort_order
FROM seeds seed
WHERE NOT EXISTS (
  SELECT 1 FROM tasks existing WHERE lower(existing.text) = lower(seed.text)
)
ON CONFLICT (id) DO NOTHING;
