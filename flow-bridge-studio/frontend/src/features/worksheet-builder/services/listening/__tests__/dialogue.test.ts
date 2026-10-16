import test from 'node:test';
import assert from 'node:assert/strict';
import { parseListeningSmartPaste } from '../listeningGapFillCore.ts';

const TEXT = `LISTEN AND FILL IN THE GAP
SUE: Excuse me. Can you help us? We're looking for the (a) __________ metro station.
TEO: Yes, it's very near here. Go straight on, along John Dobson Street towards the (b) __________ .
Walk past Durant Road. When you (c) __________ to New Bridge Street, turn right.
SUE: Sorry, I'm not sure I understood.
TEO: Sure, go along John Dobson Street, and then turn (d) __________ on to New Bridge Street.`;

test('hội thoại: mỗi lượt nói là một đoạn, tự chọn layout dialogue, không dùng tiêu đề mẫu', () => {
  const d = parseListeningSmartPaste(TEXT);
  assert.equal(d.paragraphs.length, 4);
  assert.ok(d.paragraphs[0].text.startsWith('SUE:'));
  assert.ok(d.paragraphs[1].text.includes('Walk past Durant Road'));
  assert.equal(d.settings.layout, 'dialogue');
  assert.equal(d.passageTitle, '');
  assert.deepEqual(d.blanks.map((b) => b.label), ['a', 'b', 'c', 'd']);
});

test('văn bản đánh số 1., 2. vẫn giữ layout mặc định', () => {
  const d = parseListeningSmartPaste('LISTEN\nTHINGS TO DO\n1. Go on a tour (a) ______ here.\n2. Visit the (b) ______ now.');
  assert.notEqual(d.settings.layout, 'dialogue');
});
