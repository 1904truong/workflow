// Chạy: node --experimental-strip-types --test tests/vision.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVisionRequest, checkVisionInput, parseVisionResult } from '../supabase/functions/rewrite-worksheet/vision.ts';

const layouts = [
  { id: 'pos_neg', label: '8. Khẳng định → Phủ định', desc: 'Hai cột', hint: 'POSITIVE NEGATIVE', example: 'WRITE\nPOSITIVE\tNEGATIVE\n1. I drink milk.\tI ______ tea.' },
  { id: 'q_and_a', label: '9. Hỏi và trả lời', desc: 'Ba cột', hint: 'gợi ý, câu hỏi, trả lời', example: '1. you / get up\t______ at seven?\tYes, I ______.' },
];

test('checkVisionInput: nhận ảnh data URL và danh sách layout', () => {
  const r = checkVisionInput({ image: { mime: 'image/jpeg', data: 'data:image/jpeg;base64,AAAA' }, layouts, kind: 'Sentence Completion' });
  assert.equal(r.ok, true);
  assert.equal(r.input.data, 'AAAA');
  assert.equal(r.input.layouts.length, 2);
});

test('checkVisionInput: từ chối ảnh sai loại, thiếu layout, ảnh quá lớn', () => {
  assert.equal(checkVisionInput({ image: { mime: 'image/gif', data: 'AA' }, layouts }).ok, false);
  assert.equal(checkVisionInput({ image: { mime: 'image/png', data: 'AA' }, layouts: [] }).ok, false);
  assert.equal(checkVisionInput({ image: { mime: 'image/png', data: 'A'.repeat(6_000_001) }, layouts }).status, 413);
});

test('buildVisionRequest: có ảnh inlineData và schema giới hạn layout', () => {
  const r = checkVisionInput({ image: { mime: 'image/png', data: 'AAAA' }, layouts });
  const req = buildVisionRequest(r.input);
  assert.deepEqual(req.generationConfig.responseSchema.properties.layout.enum, ['pos_neg', 'q_and_a']);
  assert.equal(req.contents[0].parts[1].inlineData.mimeType, 'image/png');
});

test('parseVisionResult: chỉ nhận layout nằm trong danh sách', () => {
  const resp = (o) => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(o) }] } }] });
  const ok = parseVisionResult(resp({ layout: 'q_and_a', confidence: 0.9, text: '1. a\tb\tc', notes: [] }), ['pos_neg', 'q_and_a']);
  assert.equal(ok.layout, 'q_and_a');
  assert.throws(() => parseVisionResult(resp({ layout: 'zzz', text: 'x', notes: [] }), ['pos_neg']));
  assert.throws(() => parseVisionResult(resp({ layout: 'pos_neg', text: '', notes: [] }), ['pos_neg']));
});
