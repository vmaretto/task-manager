import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('../../migration_voice_today_priority_commands.sql', import.meta.url);

test('migrazione pin vocale usa RPC server-only e lock condivisa col trigger', async () => {
  const sql = await readFile(migrationUrl, 'utf8');

  assert.match(sql, /CREATE OR REPLACE FUNCTION create_voice_task_with_priority_policy/i);
  assert.match(sql, /SECURITY DEFINER/i);
  assert.match(sql, /pg_advisory_xact_lock\(20260807, 1\)/i);
  assert.match(sql, /REVOKE ALL[\s\S]+FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /GRANT EXECUTE[\s\S]+TO service_role/i);
});

test('migrazione force seleziona la meno urgente e usa il task più vecchio a parità', async () => {
  const sql = await readFile(migrationUrl, 'utf8');

  assert.match(sql, /CASE candidate\.priority[\s\S]+END DESC/i);
  assert.match(sql, /candidate\.due_date DESC NULLS FIRST/i);
  assert.match(sql, /candidate\.created_at ASC/i);
  assert.match(sql, /UPDATE tasks[\s\S]+SET is_today_priority = false/i);
});
