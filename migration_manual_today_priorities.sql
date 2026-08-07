-- Manual priorities for the "Priorita di oggi" dashboard.
-- Safe to run more than once. Existing tasks default to not pinned.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS is_today_priority BOOLEAN NOT NULL DEFAULT false;

-- A completed or waiting task must never retain a manual slot.
UPDATE tasks
SET is_today_priority = false
WHERE is_today_priority
  AND (completed OR workflow_status <> 'active');

-- Defensive cleanup for databases that may already contain more than three
-- pins (for example after an interrupted offline sync). Keep the most urgent
-- three deterministically and release the rest.
WITH ranked_pins AS (
  SELECT
    id,
    row_number() OVER (
      ORDER BY
        CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
        due_date ASC NULLS LAST,
        created_at ASC,
        id ASC
    ) AS pin_position
  FROM tasks
  WHERE is_today_priority
    AND NOT completed
    AND workflow_status = 'active'
)
UPDATE tasks task
SET is_today_priority = false
FROM ranked_pins pin
WHERE task.id = pin.id
  AND pin.pin_position > 3;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
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
    -- Serialize competing pin attempts and fail clearly instead of silently
    -- replacing an existing priority.
    PERFORM pg_advisory_xact_lock(20260807, 1);

    IF (
      SELECT count(*)
      FROM tasks
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
