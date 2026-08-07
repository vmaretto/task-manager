import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createVoicePairingCode,
  hashVoicePairingCode,
  normalizeVoicePairingCode,
} from './voice-task-server.ts';

test('genera codici monouso leggibili con 100 bit di entropia', () => {
  const code = createVoicePairingCode();
  assert.match(code, /^VTP-(?:[A-HJ-NP-Z2-9]{4}-){4}[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(normalizeVoicePairingCode(code), code);
});

test('normalizza maiuscole, spazi e trattini prima del confronto', () => {
  const canonical = 'VTP-ABCD-EFGH-JKLM-NPQR-STUV';
  assert.equal(normalizeVoicePairingCode('vtp abcd efgh jklm npqr stuv'), canonical);
  assert.equal(hashVoicePairingCode('vtp-ABCD-EFGH-JKLM-NPQR-STUV'), hashVoicePairingCode(canonical));
});

test('rifiuta formati brevi e caratteri ambigui', () => {
  assert.equal(normalizeVoicePairingCode('VTP-ABCD'), null);
  assert.equal(normalizeVoicePairingCode('VTP-ABCD-EFGH-IJKL-NPQR-STUV'), null);
  assert.equal(hashVoicePairingCode('codice qualsiasi'), null);
});

test('non conserva il codice in chiaro nell’hash', () => {
  const code = createVoicePairingCode();
  const hash = hashVoicePairingCode(code);
  assert.match(hash ?? '', /^[a-f0-9]{64}$/);
  assert.notEqual(hash, code);
});
