import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSentenceCompletionText, splitTitleByTarget, guessTargetWord, createSentenceCompletion, validateSentenceCompletion } from '../sentenceCompletionCore.ts';

test('Ex1 – khung từ: tách tiêu đề, khung từ, câu; layout word_bank; đoán từ trọng tâm', () => {
  const p = parseSentenceCompletionText(`COMPLETE THE SENTENCES. USE ENOUGH WITH THESE WORDS

big   eat   loud   milk   old   practise   space   time   tired

1. 'Is there ______ in your coffee?'
2. Can you hear the radio? Is it ______ for you?
3. He can leave school if he wants—he's ______.`);
  assert.equal(p.layout, 'word_bank');
  assert.equal(p.words.length, 9);
  assert.equal(p.sentences.length, 3);
  assert.equal(p.targetWord, 'enough');
});

test('Ex2 – từ trong ngoặc ở cuối câu: layout brackets, tách gợi ý', () => {
  const p = parseSentenceCompletionText(`COMPLETE THE SENTENCES. USE ENOUGH WITH THESE WORDS IN BRACKETS.
1. We haven't got ______ a new car. (money/buy)
2. This knife isn't ______ tomatoes. (sharp/cut)
3. The water wasn't ______ swimming. (warm/go)`);
  assert.equal(p.layout, 'brackets');
  assert.deepEqual(p.sentences.map((s) => s.hint), ['money/buy', 'sharp/cut', 'warm/go']);
  assert.equal(p.sentences[0].text, "We haven't got ______ a new car.");
});

test('Ex3 – gợi ý ở đầu dòng: layout transform', () => {
  const p = parseSentenceCompletionText(`COMPLETE THE SENTENCES. USE TOO (+ ADJECTIVE) + TO
1. (I'm not going out / cold) It's ______
2. (I'm not going to bed / early) It's ______
3. (they're not getting married / young) They're ______`);
  assert.equal(p.layout, 'transform');
  assert.equal(p.sentences[0].hint, "I'm not going out / cold");
  assert.equal(p.sentences[0].text, "It's ______");
});

test('Ex4 – câu ngắn không khung từ, không gợi ý: layout two_columns', () => {
  const p = parseSentenceCompletionText(`WRITE AT/ON/IN IF NECESSARY.
1. I'm going ______ Friday.
2. I'm going ______ next Friday.
3. I always feel tired ______ the evening.`);
  assert.equal(p.layout, 'two_columns');
});

test('Target Word được nhấn mạnh trong tiêu đề, không phân biệt hoa thường', () => {
  const parts = splitTitleByTarget('COMPLETE THE SENTENCES. USE ENOUGH WITH THESE WORDS.', 'enough');
  assert.deepEqual(parts.filter((x) => x.emphasis).map((x) => x.text), ['ENOUGH']);
  assert.equal(splitTitleByTarget('ABC', '').length, 1);
  assert.equal(guessTargetWord('COMPLETE THE SENTENCES. USE TOO (+ ADJECTIVE) + TO'), 'too');
});

test('bài mới trống bị báo thiếu câu', () => {
  assert.ok(validateSentenceCompletion(createSentenceCompletion()).errors.length > 0);
});
