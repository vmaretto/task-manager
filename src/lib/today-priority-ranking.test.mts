import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildVoiceTaskMessage,
  compareTodayPriorityUrgency,
  selectTodayPriorityReplacement,
} from './today-priority-ranking.ts';

const today = '2026-08-07';

const task = (
  id: string,
  priority: 'high' | 'medium' | 'low',
  due_date: string | null,
  created_at = '2026-08-01T09:00:00Z',
) => ({ id, priority, due_date, created_at });

test('dashboard ordina prima per priorità e poi per urgenza/data', () => {
  const sorted = [
    task('medium-overdue', 'medium', '2026-08-01'),
    task('high-future', 'high', '2026-09-01'),
    task('high-today', 'high', today),
  ].sort((a, b) => compareTodayPriorityUrgency(a, b, today));

  assert.deepEqual(sorted.map((item) => item.id), ['high-today', 'high-future', 'medium-overdue']);
});

test('force sostituisce la priorità meno urgente, non quella più vecchia a prescindere', () => {
  const replacement = selectTodayPriorityReplacement([
    task('high-future', 'high', '2026-09-01', '2026-07-01T09:00:00Z'),
    task('medium-today', 'medium', today, '2026-08-01T09:00:00Z'),
    task('low-overdue', 'low', '2026-08-01', '2026-08-02T09:00:00Z'),
  ], today);

  assert.equal(replacement?.id, 'low-overdue');
});

test('force usa la data più lontana e, a parità, il task più vecchio', () => {
  const replacement = selectTodayPriorityReplacement([
    task('near', 'medium', '2026-08-08', '2026-07-01T09:00:00Z'),
    task('far-new', 'medium', '2026-09-01', '2026-08-02T09:00:00Z'),
    task('far-old', 'medium', '2026-09-01', '2026-08-01T09:00:00Z'),
  ], today);

  assert.equal(replacement?.id, 'far-old');
});

test('pin pieno non sostituisce e chiede esplicitamente di liberare un posto', () => {
  const message = buildVoiceTaskMessage({
    title: 'Inviare il report',
    needsReview: false,
    pinResult: 'full',
  });

  assert.match(message, /creato ma non fissato/i);
  assert.match(message, /3 priorità/i);
  assert.match(message, /libera un posto/i);
});

test('force comunica quale task è stato sostituito', () => {
  const message = buildVoiceTaskMessage({
    title: 'Inviare il report',
    needsReview: false,
    pinResult: 'replaced',
    replacedTaskText: 'Compilare le note spese',
  });

  assert.match(message, /ha sostituito/i);
  assert.match(message, /Compilare le note spese/);
});
