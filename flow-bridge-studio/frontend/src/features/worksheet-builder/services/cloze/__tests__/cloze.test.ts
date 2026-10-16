import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCloze, createSampleCloze, insertBlank, removeQuestion, duplicateQuestion, reorderQuestions,
  orphanQuestionIds, blankNumbersInPassage, syncBlanks, addOption, removeOption, shuffleOptionOrder,
  parseMarkup, toggleWrap, toggleListPrefix, parseClozeSmartPaste, formatOptionLabel,
  contextBefore, wordCount, bulkTextFromQuestions, applyBulkText,
} from '../clozeCore.ts';

const PASTE = `CIRCLE THE CORRECT WORDS TO COMPLETE THE TEXT.

WALL STREET
Wall Street is a street (1) _________ New York City's financial district. The Dutch gave the street (2) _________ name.

It seemed (3) _________ good to be true.

1. a. at b. in c. on
2. a. its b. it's c. their
3. a. enough b. more c. too`;

test('cloze mới: trống, không có ảnh mẫu, không có đáp án đúng', () => {
  const d = createCloze();
  assert.equal(d.passage, '');
  assert.equal(d.questions.length, 0);
  assert.equal(d.settings.imageUrl, undefined);
  assert.equal(JSON.stringify(d).includes('correctAnswer'), false);
  assert.equal(JSON.stringify(d).includes('showTeacherKey'), false);
});

test('bài mẫu Wall Street: 7 chỗ trống khớp 7 câu', () => {
  const d = createSampleCloze();
  assert.deepEqual(blankNumbersInPassage(d.passage), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(d.questions.length, 7);
  assert.deepEqual(d.questions[1].options.map((o) => o.text), ['its', "it's", 'their']);
});

test('chèn chỗ trống GIỮA đoạn văn: đánh số lại theo thứ tự, câu hỏi cũ đi theo chỗ trống của nó', () => {
  let d = createSampleCloze();
  const q2 = d.questions[1];
  const pos = d.passage.indexOf('(2)');
  d = insertBlank(d, pos);
  assert.deepEqual(blankNumbersInPassage(d.passage), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(d.questions.length, 8);
  // chỗ trống mới là số 2 -> câu hỏi trống; câu hỏi "its/it's/their" thành số 3
  assert.equal(d.questions[1].options.every((o) => o.text === ''), true);
  assert.equal(d.questions[2].id, q2.id);
  assert.equal(d.questions[2].number, 3);
});

test('xóa câu hỏi: xóa luôn chỗ trống và đánh số lại', () => {
  let d = createSampleCloze();
  const q3 = d.questions[2];
  d = removeQuestion(d, q3.id);
  assert.deepEqual(blankNumbersInPassage(d.passage), [1, 2, 3, 4, 5, 6]);
  assert.equal(d.questions.length, 6);
  assert.equal(d.questions.some((q) => q.id === q3.id), false);
  assert.equal(d.questions[2].options[0].text, 'alarm'); // câu 4 cũ thành câu 3
  assert.deepEqual(orphanQuestionIds(d), []);
});

test('nhân bản câu hỏi: thêm chỗ trống mới cuối bài, cùng lựa chọn nhưng id khác', () => {
  let d = createSampleCloze();
  d = duplicateQuestion(d, d.questions[0].id);
  assert.equal(d.questions.length, 8);
  assert.deepEqual(d.questions[7].options.map((o) => o.text), ['at', 'in', 'on']);
  assert.notEqual(d.questions[7].options[0].id, d.questions[0].options[0].id);
  assert.equal(blankNumbersInPassage(d.passage).length, 8);
});

test('câu hỏi mồ côi: xóa tay chỗ trống trong đoạn văn -> bị phát hiện, vẫn giữ dữ liệu', () => {
  const d0 = createSampleCloze();
  const d = { ...d0, passage: d0.passage.replace('(3) ________', '') };
  assert.deepEqual(orphanQuestionIds(d), [d0.questions[2].id]);
  const s = syncBlanks(d);
  assert.equal(s.questions.length, 7); // không mất dữ liệu
  assert.equal(blankNumbersInPassage(s.passage).length, 6);
});

test('đổi thứ tự câu hỏi: đánh số lại, đoạn văn giữ nguyên', () => {
  const d0 = createSampleCloze();
  const d = reorderQuestions(d0, 0, 6);
  assert.equal(d.questions[6].id, d0.questions[0].id);
  assert.deepEqual(d.questions.map((q) => q.number), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(d.passage, d0.passage);
  assert.equal(reorderQuestions(d0, 0, 99), d0);
});

test('thêm/bớt lựa chọn: tối đa 4, tối thiểu 2, nhãn a-d tự đánh lại', () => {
  let q = createSampleCloze().questions[0];
  q = addOption(q);
  assert.equal(q.options.length, 4);
  assert.equal(q.options[3].label, 'd');
  assert.equal(addOption(q).options.length, 4);
  q = removeOption(q, 0);
  assert.deepEqual(q.options.map((o) => o.label), ['a', 'b', 'c']);
  q = removeOption(removeOption(q, 0), 0);
  assert.equal(q.options.length, 2);
});

test('trộn lựa chọn: giữ nguyên tập hợp chữ, nhãn không đổi', () => {
  const d0 = createSampleCloze();
  const d = shuffleOptionOrder(d0, () => 0); // rng cố định
  d.questions.forEach((q, i) => {
    assert.deepEqual([...q.options.map((o) => o.text)].sort(), [...d0.questions[i].options.map((o) => o.text)].sort());
    assert.deepEqual(q.options.map((o) => o.label), ['a', 'b', 'c']);
  });
});

test('định dạng chữ: đậm, nghiêng, gạch chân, ký tự * đơn lẻ không bị nuốt', () => {
  assert.deepEqual(parseMarkup('a **b** c'), [{ text: 'a ' }, { text: 'b', bold: true }, { text: ' c' }]);
  assert.deepEqual(parseMarkup('x *y* ++z++'), [{ text: 'x ' }, { text: 'y', italic: true }, { text: ' ' }, { text: 'z', underline: true }]);
  assert.deepEqual(parseMarkup('2 * 3 = 6'), [{ text: '2 * 3 = 6' }]);
  assert.deepEqual(parseMarkup('**mở mà không đóng'), [{ text: '**mở mà không đóng' }]);
  // chỗ trống nằm trong vùng in đậm vẫn còn nguyên
  const seg = parseMarkup('**a (1) ________ b**');
  assert.equal(seg.length, 1);
  assert.equal(seg[0].text.includes('(1) ________'), true);
});

test('toggleWrap: bọc rồi bỏ bọc đúng vùng chọn', () => {
  const a = toggleWrap('hello world', 6, 11, '**');
  assert.equal(a.text, 'hello **world**');
  assert.equal(a.text.slice(a.selStart, a.selEnd), 'world');
  const b = toggleWrap(a.text, a.selStart, a.selEnd, '**');
  assert.equal(b.text, 'hello world');
});

test('toggleListPrefix: gạch đầu dòng và đánh số, bật rồi tắt', () => {
  const a = toggleListPrefix('one\ntwo\nthree', 0, 13, 'bullet');
  assert.equal(a.text, '• one\n• two\n• three');
  assert.equal(toggleListPrefix(a.text, a.selStart, a.selEnd, 'bullet').text, 'one\ntwo\nthree');
  assert.equal(toggleListPrefix('one\ntwo', 0, 7, 'numbered').text, '1. one\n2. two');
});

test('smart paste: tách tiêu đề, đoạn văn, 3 câu hỏi; không có đáp án đúng', () => {
  const r = parseClozeSmartPaste(PASTE);
  assert.equal(r.data.exerciseTitle, 'CIRCLE THE CORRECT WORDS TO COMPLETE THE TEXT.');
  assert.equal(r.data.passageTitle, 'WALL STREET');
  assert.equal(r.blankCount, 3);
  assert.equal(r.questionCount, 3);
  assert.deepEqual(r.data.questions[1].options.map((o) => o.text), ['its', "it's", 'their']);
  assert.deepEqual(r.warnings, []);
  assert.equal(JSON.stringify(r.data).includes('correctAnswer'), false);
});

test('smart paste: dạng mỗi lựa chọn một dòng', () => {
  const r = parseClozeSmartPaste('TITLE LINE\n\nIt was (1) ____ good.\n\n1.\na. enough\nb. more\nc. too\n2.\na. x\nb. y');
  assert.equal(r.questionCount, 2);
  assert.deepEqual(r.data.questions[0].options.map((o) => o.text), ['enough', 'more', 'too']);
});

test('smart paste: thiếu danh sách lựa chọn -> cảnh báo, không bịa bài mẫu', () => {
  const r = parseClozeSmartPaste('TITLE\n\nJust a plain paragraph with no blanks.');
  assert.equal(r.questionCount, 0);
  assert.ok(r.warnings.length >= 1);
  assert.equal(r.data.passage.includes('Wall Street'), false);
});

test('smart paste: số chỗ trống khác số câu hỏi -> cảnh báo', () => {
  const r = parseClozeSmartPaste('T\n\nA (1) ____ b (2) ____ c.\n\n1. a. x b. y c. z');
  assert.ok(r.warnings.some((w) => w.includes('khác số câu hỏi')));
});

test('nhãn lựa chọn: a. / A. / 1.', () => {
  assert.equal(formatOptionLabel(1, 'lowercase'), 'b.');
  assert.equal(formatOptionLabel(1, 'uppercase'), 'B.');
  assert.equal(formatOptionLabel(1, 'numeric'), '2.');
});

test('dữ liệu cũ dùng lineSpacing chữ được đổi sang lineHeight số', () => {
  const d = createCloze({ settings: { lineSpacing: 'spacious' } as any });
  assert.equal(d.settings.lineHeight, 1.85);
  assert.equal('lineSpacing' in d.settings, false);
  assert.equal(createCloze().settings.lineHeight, 1.5);
});

test('ngữ cảnh trước chỗ trống và đếm từ', () => {
  const d = createSampleCloze();
  assert.equal(contextBefore(d.passage, 1), 'Wall Street is a street ...');
  assert.equal(contextBefore(d.passage, 99), '');
  assert.equal(wordCount('Hello **big** world (1) ________ ok.'), 4);
});

test('bulk edit: xuất rồi nạp lại không đổi; dòng dư tạo thêm câu + chỗ trống', () => {
  const d0 = createSampleCloze();
  const txt = bulkTextFromQuestions(d0);
  assert.equal(txt.split('\n')[1], "2. its | it's | their");
  const same = applyBulkText(d0, txt);
  assert.deepEqual(same.questions.map((q) => q.options.map((o) => o.text)), d0.questions.map((q) => q.options.map((o) => o.text)));
  assert.equal(same.questions[0].id, d0.questions[0].id);
  const more = applyBulkText(d0, txt + '\n8. x | y | z | w');
  assert.equal(more.questions.length, 8);
  assert.equal(blankNumbersInPassage(more.passage).length, 8);
  assert.deepEqual(more.questions[7].options.map((o) => o.text), ['x', 'y', 'z', 'w']);
  const fewer = applyBulkText(d0, '1. only | two');
  assert.equal(fewer.questions.length, 7);
  assert.deepEqual(fewer.questions[0].options.map((o) => o.text), ['only', 'two']);
});

test('Smart Paste nhận dòng lựa chọn không có dấu chấm sau số: "1 a. chic b. vintage c. trim"', () => {
  const r = parseClozeSmartPaste(`READ THE TEXT. CHOOSE THE CORRECT ANSWERS.
PARIS
Paris is a dream destination. Parisians are famous for their (1) __________, modern style. We (2) __________ this free event at 3 p.m.
1 a. chic b. vintage c. trim
2 a. are holding b. held c. hold`);
  assert.equal(r.questionCount, 2);
  assert.equal(r.data.questions[0].options.map((o) => o.text).join('|'), 'chic|vintage|trim');
  assert.equal(r.data.passageTitle, 'PARIS');
  assert.equal(r.blankCount, 2);
});
