import assert from 'node:assert/strict';
import test from 'node:test';
import { canWrite, FULL_SCOPE, normalizeScope, READ_SCOPE } from './oauth-scope.ts';

test('senza scope il client ottiene lettura e scrittura, come prima', () => {
  assert.equal(normalizeScope(null), FULL_SCOPE);
  assert.equal(normalizeScope(''), FULL_SCOPE);
  assert.equal(normalizeScope('   '), FULL_SCOPE);
});

test('tasks:read da solo resta sola lettura', () => {
  assert.equal(normalizeScope('tasks:read'), READ_SCOPE);
  assert.equal(canWrite(normalizeScope('tasks:read')), false);
});

test('tasks:write porta sempre con sé la lettura', () => {
  assert.equal(normalizeScope('tasks:write'), FULL_SCOPE);
  assert.equal(normalizeScope('tasks:read tasks:write'), FULL_SCOPE);
  assert.equal(canWrite(normalizeScope('tasks:write tasks:read')), true);
});

test('scope sconosciuti non concedono la scrittura', () => {
  assert.equal(normalizeScope('openid profile'), READ_SCOPE);
  assert.equal(normalizeScope('tasks:admin'), READ_SCOPE);
});
