import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTfngText, highlightTfngWords, createTfng } from '../tfngCore.ts';

test('tách tiêu đề và các câu, tô đỏ TRUE / FALSE / NOT GIVEN', () => {
  const p = parseTfngText('2 CIRCLE T FOR TRUE, F FOR FALSE OR NG FOR NOT GIVEN\n1. Rio is big. ______\n2. Cities are rising.');
  assert.equal(p.ok, true);
  assert.equal(p.statements.length, 2);
  assert.equal(p.statements[0], 'Rio is big.');
  assert.equal(p.title, 'CIRCLE T FOR [[TRUE]], F FOR [[FALSE]] OR NG FOR [[NOT GIVEN]]');
});

test('tiêu đề mặc định đã tô đỏ và kiểu lựa chọn mặc định là circle', () => {
  const d = createTfng();
  assert.equal(d.settings.layout, 'circle');
  assert.equal(highlightTfngWords(d.exerciseTitle), d.exerciseTitle);
});

test('bỏ chữ T F NG dính ở cuối câu', () => {
  const p = parseTfngText('1. Rio is big. T F NG\n2. Cities rise. T / F / NG');
  assert.deepEqual(p.statements, ['Rio is big.', 'Cities rise.']);
});
