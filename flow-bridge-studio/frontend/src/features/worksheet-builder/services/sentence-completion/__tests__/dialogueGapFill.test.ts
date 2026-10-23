import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSentenceCompletionText } from '../sentenceCompletionCore.ts';

const TEXT = `WRITE DO, DOES, DON'T OR DOESN'T
Vicky: (1) ______ you like ice cream?
Zoe: Yes, I (2) ______.
Vicky: (3) ______ Corky like ice cream, too?
Zoe: Yes, he (4) ______. And he likes pizza. But he (5) ______ spinach.`;

test('bài Write hội thoại tự chọn layout dialogue gap fill', () => {
  const parsed = parseSentenceCompletionText(TEXT);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.layout, 'dialogue_gap_fill');
  assert.equal(parsed.title, "WRITE DO, DOES, DON'T OR DOESN'T");
  assert.equal(parsed.sentences.length, 4);
  assert.equal(parsed.sentences[0].text, 'Vicky: (1) ______ you like ice cream?');
  assert.match(parsed.sentences[3].text, /\(5\) ______ spinach/);
});

test('layout dialogue gap fill có thể được chọn thủ công', () => {
  const parsed = parseSentenceCompletionText(TEXT, 'dialogue_gap_fill');
  assert.equal(parsed.layout, 'dialogue_gap_fill');
  assert.deepEqual(parsed.words, []);
});
