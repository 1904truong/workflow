import test from 'node:test';
import assert from 'node:assert/strict';
import { createListeningMcq, validateListeningMcq } from '../listeningMcqCore.ts';

test('bài mới có audio rỗng, QR bật, lựa chọn xếp một cột, không hiện hướng dẫn', () => {
  const d = createListeningMcq();
  assert.equal(d.exerciseTitle, 'LISTEN AND CHOOSE THE CORRECT ANSWER');
  assert.equal(d.settings.showQrCode, true);
  assert.equal(d.settings.optionColumns, 1);
  assert.equal(d.settings.showInstruction, false);
  assert.equal(d.audio.shareUrl, undefined);
});

test('giữ cài đặt người dùng và cảnh báo thiếu link audio khi bật QR', () => {
  const d = createListeningMcq({ settings: { fontSizePt: 12 } as never });
  assert.equal(d.settings.fontSizePt, 12);
  assert.ok(validateListeningMcq(d).warnings.some((w) => w.includes('audio')));
});
