import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGapFillingText, passageSentences, splitPassage, insertBlankAt, nextBlankLabel, countBlanks, parseWordLines, createGapFilling, validateGapFilling } from '../gapFillingCore.ts';

const TEXT = `COMPLETE THE PARAGRAPH WITH THE WORDS AND PHRASES FROM THE BOX
citizens   election   pay a fine   required   vote

When a country holds a(n) (a) __________, it's an opportunity for (b) __________ to (c) __________ and to make their voices heard.

If they choose not to, they have to (e) __________ or perform community service.`;

test('tách tiêu đề, khung từ và đoạn văn', () => {
  const p = parseGapFillingText(TEXT);
  assert.equal(p.ok, true);
  assert.equal(p.title, 'COMPLETE THE PARAGRAPH WITH THE WORDS AND PHRASES FROM THE BOX');
  assert.deepEqual(p.words, ['citizens', 'election', 'pay a fine', 'required', 'vote']);
  assert.equal(countBlanks(p.passage), 4);
});

test('dòng "Word bank:" và dòng đoạn văn không bị nhầm thành khung từ', () => {
  assert.deepEqual(parseGapFillingText('Word bank: a, b, c\nI have (a) ______ here.').words, ['a', 'b', 'c']);
  assert.equal(parseGapFillingText('She went home, ate dinner, and slept (a) ______ well').words.length, 0);
});

test('splitPassage, nhãn kế tiếp và chèn chỗ trống', () => {
  const parts = splitPassage('Hi (a) ______ there ______ end');
  assert.deepEqual(parts.map((x) => x.kind), ['text', 'blank', 'text', 'blank', 'text']);
  assert.equal(nextBlankLabel('x (a) ____ y (b) ____'), 'c');
  const r = insertBlankAt('Hello world', 5);
  assert.equal(r.text, 'Hello (a) ________ world');
});

test('import khung từ và kiểm tra dữ liệu', () => {
  assert.deepEqual(parseWordLines('one, two, three'), ['one', 'two', 'three']);
  assert.deepEqual(parseWordLines('1. one\n2. two'), ['one', 'two']);
  assert.ok(validateGapFilling(createGapFilling()).errors.length > 0);
});

test('câu đánh số 1., 2. tự chọn layout numbered_list và tách theo từng dòng', () => {
  const p = parseGapFillingText('COMPLETE THE QUESTIONS USING A PHRASAL VERB FROM THE BOX\nmeet up with  look for  hang out with\n\n1. I ______ in this neighbourhood.\n2. The bus is the best way to ______.\n3. What do you ______ in a city?');
  assert.equal(p.layout, 'numbered_list');
  assert.deepEqual(p.words, ['meet up with', 'look for', 'hang out with']);
  assert.deepEqual(passageSentences(p.passage), ['I ______ in this neighbourhood.', 'The bus is the best way to ______.', 'What do you ______ in a city?']);
  assert.equal(parseGapFillingText('Word bank: a, b, c\nI have (a) ______ here.').layout, 'box_paragraph');
});

test('đề thật: tiêu đề xuống 2 dòng, khung từ 2 dòng có "x2"', () => {
  const p = parseGapFillingText(`COMPLETE THE QUESTIONS USING A PHRASAL VERB FROM THE BOX AND PUT THE VERBS INTO CORRECT FORM.

meet up with    look for x2   hang out with x2
get around x2  grow up x2   look forward to

1. I ______ in this neighbourhood.
2. The bus is the best way to ______.
3. What do you ______ in a city?`);
  assert.equal(p.title, 'COMPLETE THE QUESTIONS USING A PHRASAL VERB FROM THE BOX AND PUT THE VERBS INTO CORRECT FORM.');
  assert.deepEqual(p.words, ['meet up with', 'look for', 'hang out with', 'get around', 'grow up', 'look forward to']);
  assert.equal(p.layout, 'numbered_list');
  assert.equal(passageSentences(p.passage).length, 3);
});
