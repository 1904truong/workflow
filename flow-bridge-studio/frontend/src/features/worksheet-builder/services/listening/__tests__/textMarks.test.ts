import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMarkPatch, attrsInRange, clearMarks, marksAfterTextChange, remapMarks, segmentText, sliceMarks, normalizeMarks,
} from '../textMarks.ts';

const T = 'Yesterday I went to the (a) __________ with friends.';

test('bôi đen một từ và Bold: chỉ từ đó đậm', () => {
  const m = applyMarkPatch(undefined, T.length, 0, 9, { bold: true });
  assert.deepEqual(m, [{ start: 0, end: 9, bold: true }]);
  assert.equal(attrsInRange(m, T.length, 0, 9).bold, true);
  assert.equal(attrsInRange(m, T.length, 0, 12).bold, undefined);
});

test('bỏ Bold giữa đoạn đậm → tách đôi', () => {
  let m = applyMarkPatch(undefined, T.length, 0, 20, { bold: true });
  m = applyMarkPatch(m, T.length, 5, 10, { bold: false });
  assert.deepEqual(m, [{ start: 0, end: 5, bold: true }, { start: 10, end: 20, bold: true }]);
});

test('các định dạng khác nhau cùng tồn tại và gộp đoạn kề cùng thuộc tính', () => {
  let m = applyMarkPatch(undefined, T.length, 0, 5, { bold: true });
  m = applyMarkPatch(m, T.length, 5, 10, { bold: true });
  m = applyMarkPatch(m, T.length, 3, 7, { color: '#f00' });
  assert.deepEqual(m, [
    { start: 0, end: 3, bold: true }, { start: 3, end: 7, bold: true, color: '#f00' }, { start: 7, end: 10, bold: true },
  ]);
});

test('gõ chữ trước mark: mark dịch theo, chữ mới không đậm', () => {
  const m = applyMarkPatch(undefined, T.length, 10, 14, { bold: true });
  const next = marksAfterTextChange(T, 'AB' + T, m);
  assert.deepEqual(next, [{ start: 12, end: 16, bold: true }]);
});

test('gõ giữa mark: chữ mới thừa hưởng định dạng (giống Word)', () => {
  const m = applyMarkPatch(undefined, T.length, 0, 9, { bold: true });
  const next = marksAfterTextChange(T, T.slice(0, 4) + 'XX' + T.slice(4), m, { bold: true });
  assert.deepEqual(next, [{ start: 0, end: 11, bold: true }]);
});

test('xóa vùng chứa mark', () => {
  const m = applyMarkPatch(undefined, T.length, 5, 15, { italic: true });
  const next = marksAfterTextChange(T, T.slice(0, 8) + T.slice(12), m);
  assert.deepEqual(next, [{ start: 5, end: 11, italic: true }]);
});

test('đổi nhãn chỗ trống (a)→(10) vẫn giữ mark sau đó', () => {
  const at = T.indexOf('(a)');
  const m = applyMarkPatch(undefined, T.length, T.length - 8, T.length - 1, { bold: true });
  const next = remapMarks(m, [{ at, oldLen: 3, newLen: 4 }], T.length + 1);
  assert.deepEqual(next, [{ start: T.length - 8 + 1, end: T.length, bold: true }]);
});

test('clearMarks và normalize', () => {
  const m = applyMarkPatch(undefined, 20, 0, 10, { bold: true, color: '#111' });
  assert.equal(clearMarks(m, 20, 0, 10), undefined);
  assert.equal(normalizeMarks([{ start: 5, end: 5, bold: true }], 20), undefined);
});

test('sliceMarks / segmentText', () => {
  const m = applyMarkPatch(undefined, 20, 4, 8, { bold: true });
  assert.deepEqual(sliceMarks(m, 2, 10), [{ start: 2, end: 6, bold: true }]);
  assert.deepEqual(segmentText(m, 0, 10).map((s) => [s.start, s.end, !!s.attrs.bold]), [[0, 4, false], [4, 8, true], [8, 10, false]]);
});
