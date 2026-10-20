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

test('Ex5 – tìm lỗi và sửa: tiêu đề "FIND THE MISTAKES" chọn layout error_correction, giữ nguyên câu', () => {
  const p = parseSentenceCompletionText(`FIND THE MISTAKES AND CORRECT
1. This is the more wonderful book she has ever read.
2. No mountain in the world is the biggest than Everest.
3. Bill Gates is the richer people in the world.`);
  assert.equal(p.layout, 'error_correction');
  assert.equal(p.sentences.length, 3);
  assert.equal(p.sentences[1].text, 'No mountain in the world is the biggest than Everest.');
});

test('Ex6 – viết lại câu: dòng mở đầu không số ghép vào câu đứng trước, bỏ gạch dưới', () => {
  const p = parseSentenceCompletionText(`REWRITE THE SENTENCES
1. Listening to music is more interesting than watching TV.
I prefer ______
2. It isn't important for you to finish the work today.
You don't ______
3. How much is this dictionary?
What ______`);
  assert.equal(p.layout, 'rewrite');
  assert.equal(p.sentences.length, 3);
  assert.equal(p.sentences[0].text, 'Listening to music is more interesting than watching TV.');
  assert.deepEqual(p.sentences.map((s) => s.starter), ['I prefer', "You don't", 'What']);
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
