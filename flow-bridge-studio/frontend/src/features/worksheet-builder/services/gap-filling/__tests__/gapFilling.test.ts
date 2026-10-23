import test from 'node:test';
import assert from 'node:assert/strict';
import { passageLines, buildGapImagePrompt, passageColumns, looksTwoColumns, parseGapFillingText, passageSentences, splitPassage, insertBlankAt, nextBlankLabel, countBlanks, parseWordLines, createGapFilling, validateGapFilling } from '../gapFillingCore.ts';

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

const TWO_COL = `CHOOSE AND WRITE
like   eat   play   buy   take   drink

Positive ✓
Vicky __________ chocolate cake.
The cat __________ milk.
Brian __________ books.

Negative ✗
She __________ spinach.
It __________ orange juice.
He __________ comics.`;

test('hai cột Positive / Negative: tự chọn layout two_columns, giữ tiêu đề cột và từng câu', () => {
  const p = parseGapFillingText(TWO_COL);
  assert.equal(p.title, 'CHOOSE AND WRITE');
  assert.deepEqual(p.words, ['like', 'eat', 'play', 'buy', 'take', 'drink']);
  assert.equal(p.layout, 'two_columns');
  const cols = passageColumns(p.passage);
  assert.equal(cols.length, 2);
  assert.equal(cols[0].heading, 'Positive ✓');
  assert.equal(cols[1].heading, 'Negative ✗');
  assert.equal(cols[0].lines.length, 3);
  assert.equal(cols[1].lines[2], 'He __________ comics.');
});

test('đoạn văn thường và danh sách đánh số không bị nhận nhầm là hai cột', () => {
  assert.equal(looksTwoColumns('First (a) ______ paragraph here.\n\nSecond (b) ______ paragraph here.'), false);
  assert.equal(looksTwoColumns('1. I ______ here.\n2. You ______ there.'), false);
  assert.equal(parseGapFillingText(TEXT).layout, 'box_paragraph');
});

test('passageLines giữ từng dòng và khổ cách nhau dòng trống', () => {
  assert.deepEqual(passageLines('\n The ___ likes a,\nHe ___ b.\n\n\n\nPeas...\n'), ['The ___ likes a,', 'He ___ b.', '', 'Peas...']);
});

test('buildGapImagePrompt dùng khung từ làm gợi ý', () => {
  const d = createGapFilling({ words: [{ id: '1', text: 'zebra' }, { id: '2', text: 'hippo' }], passage: 'The ____ likes peas,' });
  assert.match(buildGapImagePrompt(d), /zebra, hippo/);
});

test('khung từ viết thường cách nhau một dấu cách (bài hát zebra) được tách khỏi lời bài hát', () => {
  const p = parseGapFillingText('LISTEN AND FILL THE GAPS\nzebra peas carrots eat hippo bananas like\nparrot sandwiches pizza.\nThe _____ likes sausages,\nHe doesn\'t like _____.');
  assert.deepEqual(p.words, ['zebra', 'peas', 'carrots', 'eat', 'hippo', 'bananas', 'like', 'parrot', 'sandwiches', 'pizza']);
  assert.equal(p.passage.split('\n').length, 2);
});
