import test from 'node:test';
import assert from 'node:assert/strict';
import { pruneRichMarks, richMarksFor, setRichMarks, tidyRichEdit } from '../richFields.ts';
import { applyMarkPatch, attrsToStyle, segmentText } from '../listening/textMarks.ts';

test('chọn riêng từ "zebra" rồi in đậm + đổi màu: chỉ từ đó có định dạng', () => {
  const text = 'The zebra likes bananas.';
  const marks = applyMarkPatch(undefined, text.length, 4, 9, { bold: true, color: '#1d4ed8', fontSizePt: 14 });
  const map = setRichMarks(undefined, text, text, marks);
  const segs = segmentText(richMarksFor(map, text), 0, text.length);
  assert.deepEqual(segs.map((s) => text.slice(s.start, s.end)), ['The ', 'zebra', ' likes bananas.']);
  assert.deepEqual(segs[1].attrs, { bold: true, color: '#1d4ed8', fontSizePt: 14 });
  assert.deepEqual(segs[0].attrs, {});
  assert.deepEqual(segs[2].attrs, {});
});

test('sửa chữ trên trang: định dạng chuyển sang khóa mới, khóa cũ bị bỏ', () => {
  const m1 = setRichMarks(undefined, 'Hello', 'Hello', [{ start: 0, end: 5, bold: true }]);
  const m2 = setRichMarks(m1, 'Hello', 'Hello world', [{ start: 0, end: 5, bold: true }]);
  assert.equal(m2?.['Hello'], undefined);
  assert.deepEqual(m2?.['Hello world'], [{ start: 0, end: 5, bold: true }]);
});

test('xóa hết định dạng thì không còn khóa nào', () => {
  const m1 = setRichMarks(undefined, 'A b', 'A b', [{ start: 0, end: 1, italic: true }]);
  assert.equal(setRichMarks(m1, 'A b', 'A b', undefined), undefined);
});

test('chữ đổi ở nơi khác: marks không khớp độ dài thì bỏ qua (không vẽ lệch)', () => {
  const map = { abc: [{ start: 0, end: 3, bold: true }] };
  assert.ok(richMarksFor(map, 'abc'));
  assert.equal(richMarksFor(map, 'ab'), undefined);
  assert.equal(richMarksFor({ ab: [{ start: 0, end: 3, bold: true }] }, 'ab'), undefined);
});

test('tidyRichEdit cắt khoảng trắng hai đầu và dịch marks theo', () => {
  const r = tidyRichEdit('  big cat ', [{ start: 2, end: 5, bold: true }]);
  assert.equal(r.text, 'big cat');
  assert.deepEqual(r.marks, [{ start: 0, end: 3, bold: true }]);
  assert.equal(tidyRichEdit('a\nb', undefined).text, 'a b');
});

test('pruneRichMarks chỉ giữ khóa còn dùng', () => {
  const map = { a: [{ start: 0, end: 1, bold: true }], b: [{ start: 0, end: 1, bold: true }] };
  assert.deepEqual(Object.keys(pruneRichMarks(map, ['a']) || {}), ['a']);
  assert.equal(pruneRichMarks(map, []), undefined);
});

test('gạch ngang, chỉ số trên/dưới có CSS đúng', () => {
  assert.equal(attrsToStyle({ underline: true, strike: true }).textDecoration, 'underline line-through');
  assert.equal(attrsToStyle({ script: 'super' }).verticalAlign, 'super');
  assert.equal(attrsToStyle({ script: 'sub', fontSizePt: 10 }).fontSize, '7pt');
});
