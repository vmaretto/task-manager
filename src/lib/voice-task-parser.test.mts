import assert from 'node:assert/strict';
import test from 'node:test';
import { parseVoiceTask } from './voice-task-parser.ts';

const projects = [
  { id: 'wise-id', name: 'WISE' },
  { id: 'master-id', name: 'Master Carbon Farming' },
  { id: 'peroni-id', name: 'Birra Peroni / BEST' },
];

test('estrae titolo, domani, priorità, progetto e responsabile', () => {
  const parsed = parseVoiceTask(
    'Ricordami di chiamare Giuseppe domani, priorità alta, progetto WISE, responsabile Marco',
    projects,
    '2026-08-07',
  );

  assert.equal(parsed.title, 'Chiamare Giuseppe');
  assert.equal(parsed.priority, 'high');
  assert.equal(parsed.dueDate, '2026-08-08');
  assert.equal(parsed.projectId, 'wise-id');
  assert.equal(parsed.assignee, 'Marco');
  assert.equal(parsed.needsReview, false);
});

test('interpreta data italiana e priorità bassa', () => {
  const parsed = parseVoiceTask(
    'Preparare le slide entro 12 agosto 2026 con priorità bassa per Master Carbon Farming',
    projects,
    '2026-08-07',
  );

  assert.equal(parsed.title, 'Preparare le slide');
  assert.equal(parsed.priority, 'low');
  assert.equal(parsed.dueDate, '2026-08-12');
  assert.equal(parsed.projectId, 'master-id');
  assert.equal(parsed.needsReview, false);
});

test('non inventa un progetto o un responsabile sconosciuti', () => {
  const parsed = parseVoiceTask(
    'Creare task: controllare il preventivo, progetto Apollo, responsabile Luca',
    projects,
    '2026-08-07',
  );

  assert.equal(parsed.projectId, null);
  assert.equal(parsed.assignee, null);
  assert.equal(parsed.needsReview, true);
  assert.match(parsed.reviewReasons.join(' '), /progetto/i);
  assert.match(parsed.reviewReasons.join(' '), /responsabile/i);
});

test('marca come ambigue scadenze e priorità in conflitto', () => {
  const parsed = parseVoiceTask(
    'Chiamare Ida oggi o domani con priorità alta e priorità bassa',
    projects,
    '2026-08-07',
  );

  assert.equal(parsed.dueDate, null);
  assert.equal(parsed.priority, 'medium');
  assert.equal(parsed.needsReview, true);
  assert.match(parsed.reviewReasons.join(' '), /scadenze/i);
  assert.match(parsed.reviewReasons.join(' '), /priorità/i);
});

test('rifiuta date impossibili senza inventare una scadenza', () => {
  const parsed = parseVoiceTask('Pagare fattura entro 31/02/2026', projects, '2026-08-07');
  assert.equal(parsed.dueDate, null);
  assert.equal(parsed.needsReview, true);
  assert.match(parsed.reviewReasons.join(' '), /non è valida/i);
});

test('non scambia una parte di parola per il nome di un progetto', () => {
  const parsed = parseVoiceTask(
    'Comprare un regalo domani',
    [...projects, { id: 'gal-id', name: 'GAL' }],
    '2026-08-07',
  );
  assert.equal(parsed.projectId, null);
  assert.equal(parsed.needsReview, false);
});
