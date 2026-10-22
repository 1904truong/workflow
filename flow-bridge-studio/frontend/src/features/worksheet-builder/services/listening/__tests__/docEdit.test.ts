import test from 'node:test';
import assert from 'node:assert/strict';
import type { ListeningParagraph } from '../listeningGapFillCore.ts';
import { applyFormatDoc, attrsInDocRange, clearFormatDoc, docSlice, expandForGaps, orderRange, replaceRange } from '../docEdit.ts';

const mk = (id: string, text: string, extra: Partial<ListeningParagraph> = {}): ListeningParagraph => ({ id, order: 0, text, ...extra });
const doc = (): ListeningParagraph[] => [
  mk('p1', 'Go on a Big Bus tour (a) __________ in London.'),
  mk('p2', 'Visit the Tate Modern (b) __________ today.', { format: { align: 'center' } }),
  mk('p3', 'Meet famous people at the museum.'),
].map((p, i) => ({ ...p, order: i + 1 }));
let n = 0;
const newId = () => `new${++n}`;

test('gõ giữa một đoạn: giữ id, không đổi cấu trúc, caret đúng', () => {
  const r = replaceRange(doc(), { from: { para: 0, off: 6 }, to: { para: 0, off: 6 } }, [{ text: 'XX' }]);
  assert.equal(r.paragraphs[0].text.slice(0, 10), 'Go on XXa ');
  assert.equal(r.paragraphs.length, 3);
  assert.equal(r.structureChanged, false);
  assert.deepEqual(r.caret, { para: 0, off: 8 });
});

test('xóa vùng chọn qua nhiều đoạn → gộp đoạn, đánh lại số thứ tự', () => {
  const d = doc();
  const from = { para: 0, off: 6 };
  const to = { para: 2, off: 5 };
  const r = replaceRange(d, { from, to }, [{ text: '' }]);
  assert.equal(r.paragraphs.length, 1);
  assert.equal(r.paragraphs[0].id, 'p1');
  assert.equal(r.paragraphs[0].text, 'Go on famous people at the museum.');
  assert.equal(r.paragraphs[0].order, 1);
  assert.equal(r.structureChanged, true);
});

test('Enter giữa đoạn: tách đoạn mới (id mới, chép định dạng đoạn), đánh lại số', () => {
  const r = replaceRange(doc(), { from: { para: 1, off: 6 }, to: { para: 1, off: 6 } }, [{ text: '' }, { text: '' }], { newId });
  assert.equal(r.paragraphs.length, 4);
  assert.equal(r.paragraphs[1].text, 'Visit ');
  assert.equal(r.paragraphs[2].text.startsWith('the Tate Modern'), true);
  assert.deepEqual(r.paragraphs[2].format, { align: 'center' });
  assert.notEqual(r.paragraphs[2].id, 'p2');
  assert.deepEqual(r.paragraphs.map((p) => p.order), [1, 2, 3, 4]);
  assert.deepEqual(r.caret, { para: 2, off: 0 });
});

test('marks dịch đúng khi gộp đoạn', () => {
  const d = doc();
  d[2] = { ...d[2], marks: [{ start: 0, end: 4, bold: true }] }; // "Meet"
  const r = replaceRange(d, { from: { para: 1, off: d[1].text.length }, to: { para: 2, off: 0 } }, [{ text: '' }]);
  const p = r.paragraphs[1];
  assert.ok(p.text.endsWith('today.Meet famous people at the museum.'));
  const m = p.marks![0];
  assert.equal(p.text.slice(m.start, m.end), 'Meet');
});

test('chỗ trống là khối nguyên: xóa chạm vào chỗ trống ôm trọn cả chỗ trống', () => {
  const d = doc();
  const gapStart = d[0].text.indexOf('(a)');
  const r = replaceRange(d, { from: { para: 0, off: gapStart + 1 }, to: { para: 0, off: gapStart + 2 } }, [{ text: '' }]);
  assert.equal(r.paragraphs[0].text.includes('(a)'), false);
  assert.equal(r.paragraphs[0].text.includes('__'), false);
  // con trỏ nằm giữa chỗ trống khi gõ → chuyển ra sau chỗ trống
  const e = expandForGaps(d, { from: { para: 0, off: gapStart + 2 }, to: { para: 0, off: gapStart + 2 } });
  assert.equal(e.from.off, gapStart + d[0].text.slice(gapStart).indexOf('_') + 10);
});

test('chữ mới thừa hưởng định dạng (inherit)', () => {
  const r = replaceRange(doc(), { from: { para: 0, off: 0 }, to: { para: 0, off: 0 } }, [{ text: 'Hi ' }], { inherit: { bold: true } });
  assert.deepEqual(r.paragraphs[0].marks, [{ start: 0, end: 3, bold: true }]);
});

test('Ctrl+A rồi Bold: mọi đoạn đều đậm; attrs chung báo bold', () => {
  const d = doc();
  const range = { from: { para: 0, off: 0 }, to: { para: 2, off: d[2].text.length } };
  const out = applyFormatDoc(d, range, { bold: true });
  for (const p of out) assert.deepEqual(p.marks, [{ start: 0, end: p.text.length, bold: true }]);
  assert.equal(attrsInDocRange(out, range).bold, true);
  assert.equal(attrsInDocRange(d, range).bold, undefined);
  const cleared = clearFormatDoc(out, range);
  assert.ok(cleared.every((p) => !p.marks));
});

test('attrs chung chỉ giữ thuộc tính mọi đoạn đều có', () => {
  const d = doc();
  const a = applyFormatDoc(d, { from: { para: 0, off: 0 }, to: { para: 1, off: 5 } }, { bold: true });
  const b = applyFormatDoc(a, { from: { para: 0, off: 0 }, to: { para: 0, off: 5 } }, { italic: true });
  const attrs = attrsInDocRange(b, { from: { para: 0, off: 0 }, to: { para: 1, off: 5 } });
  assert.equal(attrs.bold, true);
  assert.equal(attrs.italic, undefined);
});

test('docSlice + orderRange cho copy', () => {
  const d = doc();
  const r = orderRange({ para: 1, off: 3 }, { para: 0, off: 2 });
  assert.deepEqual(r, { from: { para: 0, off: 2 }, to: { para: 1, off: 3 } });
  const s = docSlice(d, r);
  assert.equal(s.length, 2);
  assert.equal(s[0].text, d[0].text.slice(2));
  assert.equal(s[1].text, 'Vis');
});
