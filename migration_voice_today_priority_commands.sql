-- Creazione task vocale con pin normale/forzato atomico (idempotente).
-- Applicare dopo migration_manual_today_priorities.sql e migration_voice_tasks.sql.

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
    -- Stessa serratura del trigger generale: conteggio, eventuale sostituzione e
    -- INSERT sono serializzati anche rispetto ai pin creati dalla UI normale.
    PERFORM pg_advisory_xact_lock(20260807, 1);

    SELECT count(*) INTO pin_count
    FROM tasks pinned
    WHERE pinned.is_today_priority
      AND NOT pinned.completed
      AND pinned.workflow_status = 'active';

    IF pin_count > 3 THEN
      RAISE EXCEPTION 'Stato delle priorità incoerente: risultano più di 3 task fissati.'
        USING ERRCODE = '23514';
    ELSIF pin_count < 3 THEN
      should_pin := true;
      result_code := 'pinned';
    ELSIF NOT force_pin THEN
      should_pin := false;
      result_code := 'full';
    ELSE
      -- Vittima = meno urgente secondo la stessa gerarchia dashboard:
      -- priorità, stato della data, data. A parità sostituisce la più vecchia.
      SELECT candidate.id, candidate.text
      INTO victim_id, victim_text
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

      UPDATE tasks target
      SET is_today_priority = false
      WHERE target.id = victim_id
        AND target.is_today_priority;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'La priorità da sostituire è cambiata: riprova il comando.'
          USING ERRCODE = '40001';
      END IF;

      should_pin := true;
      result_code := 'replaced';
    END IF;
  END IF;

  INSERT INTO tasks (
    text,
    notes,
    project_id,
    priority,
    due_date,
    category,
    completed,
    workflow_status,
    is_today_priority,
    needs_review,
    source
  )
  VALUES (
    btrim(p_text),
    COALESCE(p_notes, ''),
    p_project_id,
    p_priority,
    p_due_date,
    'work',
    false,
    'active',
    should_pin,
    COALESCE(p_needs_review, false),
    'voice'
  )
  RETURNING id, text, tasks.is_today_priority
  INTO created_task_id, created_task_text, created_is_pinned;

  RETURN QUERY SELECT
    created_task_id,
    created_task_text,
    created_is_pinned,
    result_code,
    victim_id,
    victim_text;
END;
$$;

REVOKE ALL ON FUNCTION create_voice_task_with_priority_policy(TEXT, TEXT, UUID, TEXT, DATE, BOOLEAN, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_voice_task_with_priority_policy(TEXT, TEXT, UUID, TEXT, DATE, BOOLEAN, TEXT)
  TO service_role;
