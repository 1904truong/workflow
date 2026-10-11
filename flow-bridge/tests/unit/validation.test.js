import test from 'node:test';
import assert from 'node:assert/strict';

import { isAllowedOrigin, isValidEnvelope, sanitizePrompt } from '../../packages/shared/validation/index.ts';
import { createEnvelope, createErrorEnvelope } from '../../packages/shared/messages/index.ts';

test('Origin Validation: allows whitelisted origins', () => {
  assert.equal(isAllowedOrigin('http://localhost:5173'), true);
  assert.equal(isAllowedOrigin('http://127.0.0.1:5173'), true);
  assert.equal(isAllowedOrigin('http://localhost:3000'), true);
  assert.equal(isAllowedOrigin('chrome-extension://abcdefghijklm'), true);
});

test('Origin Validation: rejects unauthorized origins', () => {
  assert.equal(isAllowedOrigin('http://malicious-site.com'), false);
  assert.equal(isAllowedOrigin('https://fake-google-flow.com'), false);
  assert.equal(isAllowedOrigin('http://localhost:8080'), false);
  assert.equal(isAllowedOrigin(''), false);
});

test('Envelope Validation: accepts valid envelopes', () => {
  const env = createEnvelope('PING', 'web', { test: true });
  assert.equal(isValidEnvelope(env), true);
  assert.equal(env.type, 'PING');
  assert.equal(env.source, 'web');
  assert.ok(env.id.startsWith('req_'));
  assert.ok(env.timestamp > 0);
});

test('Envelope Validation: rejects malformed envelopes', () => {
  assert.equal(isValidEnvelope(null), false);
  assert.equal(isValidEnvelope({}), false);
  assert.equal(isValidEnvelope({ id: '', type: 'PING', source: 'web', timestamp: Date.now() }), false);
  assert.equal(isValidEnvelope({ id: '1', type: 'INVALID_TYPE', source: 'web', timestamp: Date.now() }), false);
  assert.equal(isValidEnvelope({ id: '1', type: 'PING', source: 'attacker', timestamp: Date.now() }), false);
  assert.equal(isValidEnvelope({ id: '1', type: 'PING', source: 'web', timestamp: -10 }), false);
});

test('Error Envelope: creates structured error responses', () => {
  const err = createErrorEnvelope('extension', 'FLOW_TAB_NOT_FOUND', 'Tab is missing', 'req_123', { hint: 'open tab' });
  assert.equal(err.type, 'ERROR');
  assert.equal(err.source, 'extension');
  assert.equal(err.id, 'req_123');
  assert.equal(err.error?.code, 'FLOW_TAB_NOT_FOUND');
  assert.equal(err.error?.message, 'Tab is missing');
  assert.deepEqual(err.error?.details, { hint: 'open tab' });
});

test('Sanitize Prompt: trims and caps prompt length safely', () => {
  const longPrompt = 'a'.repeat(5000);
  const sanitized = sanitizePrompt(longPrompt);
  assert.equal(sanitized.length, 4000);

  assert.equal(sanitizePrompt('   Hello Flow   '), 'Hello Flow');
  assert.equal(sanitizePrompt(''), '');
});
