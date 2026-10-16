import test from 'node:test';
import assert from 'node:assert/strict';
import { parseListeningSmartPaste } from '../listeningGapFillCore.ts';

test('dàn ý • / + : tách dòng chính và dòng con, tự chọn layout outline', () => {
  const d = parseListeningSmartPaste(`LISTEN AND FILL IN THE GAP
• She grew up in Whitworth in (1) __________.
+ Population: (2) __________ people.
+ Description: (3) __________.
• In 2009, she moved to Sydney.`);
  assert.equal(d.settings.layout, 'outline');
  assert.equal(d.paragraphs.length, 4);
  assert.equal(d.paragraphs[0].format?.indentMm, 0);
  assert.equal(d.paragraphs[1].format?.indentMm, 6);
  assert.equal(d.blanks.length, 3);
});
