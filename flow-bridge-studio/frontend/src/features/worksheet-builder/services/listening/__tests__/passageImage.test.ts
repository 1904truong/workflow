import test from 'node:test';
import assert from 'node:assert/strict';
import { parseListeningSmartPaste } from '../listeningGapFillCore.ts';

const TEXT = `LISTEN AND FILL IN THE GAP. THEN ANSWER THE QUESTIONS BELOW.
A FLOATING CITY
The day after school finished for the summer, my
mum and dad won a (a) __________ in a competition!

I decided to find out a little more about it. I was quite
(c) __________ and shocked to discover that Harmony of
the Seas is the biggest cruise liner.

The swimming pools look (h) __________! There are 23 of them.
1. Where did the writer and his family go for their holiday?
   __________
2. How many workers building that ship?
3. What did the writer want to try on that ship?`;

test('bài đọc không đánh số + câu hỏi: tách đoạn bằng dòng trống, câu hỏi riêng, tự chọn layout passage_image', () => {
  const d = parseListeningSmartPaste(TEXT);
  assert.equal(d.passageTitle, 'A FLOATING CITY');
  assert.equal(d.paragraphs.length, 3);
  assert.ok(d.paragraphs[0].text.startsWith('The day after school'));
  assert.ok(d.paragraphs[0].text.includes('won a (a) __________ in a competition!'));
  assert.equal(d.questions?.length, 3);
  assert.equal(d.questions?.[0].text, 'Where did the writer and his family go for their holiday?');
  assert.equal(d.settings.layout, 'passage_image');
  assert.deepEqual(d.blanks.map((b) => b.label), ['a', 'c', 'h']);
});

test('đoạn đánh số có chỗ trống không bị coi là câu hỏi', () => {
  const d = parseListeningSmartPaste('LISTEN\nTHINGS TO DO\n1. Go on a tour (a) ______ here?\n2. Visit the (b) ______ now.');
  assert.equal(d.questions, undefined);
  assert.notEqual(d.settings.layout, 'passage_image');
});
