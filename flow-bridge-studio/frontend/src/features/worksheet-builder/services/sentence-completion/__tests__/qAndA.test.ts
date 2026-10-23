import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSentenceCompletionText } from '../sentenceCompletionCore.ts';

test('q_and_a: gợi ý và câu hỏi ở hai dòng được ghép lại, câu hỏi tách khỏi câu trả lời', () => {
  const raw = "WRITE QUESTIONS AND ANSWERS\n1. you / get up\n__________ at seven o'clock? Yes, I _____.\n2. they / drink\n__________ juice in the morning? No, they _____.\n3. you / do your homework\n__________ in the evening? Yes, I";
  const p = parseSentenceCompletionText(raw, 'q_and_a');
  assert.equal(p.layout, 'q_and_a');
  assert.equal(p.title, 'WRITE QUESTIONS AND ANSWERS');
  assert.equal(p.sentences.length, 3);
  assert.deepEqual(p.sentences[0], { hint: 'you / get up', text: "__________ at seven o'clock?", starter: 'Yes, I _____.' });
  assert.equal(p.sentences[2].starter, 'Yes, I');
});
