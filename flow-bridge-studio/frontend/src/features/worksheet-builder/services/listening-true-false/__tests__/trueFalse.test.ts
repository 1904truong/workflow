import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTrueFalseText, highlightTfWords, createListeningTrueFalse, validateTrueFalse, buildTfImagePrompt,
  imagePromptFromPlan, setTfStyle, bumpTfSize, moveTfItem,
} from '../listeningTrueFalseCore.ts';

const SAMPLE = `3 LISTEN TO A RADIO PROGRAMME ABOUT A TRAVELLER. ARE THE SENTENCES
TRUE (T) OR FALSE (F)?
1. Terri never walks around cities.   __________
2. Terri went to Istanbul two years ago.   __________
3. People always helped him when he was lost.
4. Terri once used his sense of smell to find
out where he was.   __________
5. In Istanbul people usually queue at bus stops.`;

test('tách tiêu đề, các câu và bỏ dòng kẻ cuối câu', () => {
  const r = parseTrueFalseText(SAMPLE);
  assert.equal(r.ok, true);
  assert.equal(r.statements.length, 5);
  assert.equal(r.statements[0], 'Terri never walks around cities.');
  assert.equal(r.statements[3], 'Terri once used his sense of smell to find out where he was.');
  assert.ok(r.title.startsWith('LISTEN TO A RADIO PROGRAMME'));
  assert.ok(!r.title.startsWith('3 '));
});

test('tự tô đỏ TRUE (T) / FALSE (F) bằng [[ ]], không tô lại khi đã có', () => {
  const r = parseTrueFalseText(SAMPLE);
  assert.ok(r.title.includes('[[TRUE (T)]]'));
  assert.ok(r.title.includes('[[FALSE (F)]]'));
  assert.equal(highlightTfWords('A [[TRUE]] B'), 'A [[TRUE]] B');
});

test('không có câu nào -> không ok', () => {
  assert.equal(parseTrueFalseText('chỉ có tiêu đề').ok, false);
});

test('validate: thiếu câu, câu trống, cảnh báo QR chưa có link', () => {
  const d = createListeningTrueFalse({ statements: [{ id: 'a', text: '' }] });
  const v = validateTrueFalse(d);
  assert.equal(v.errors.length, 1);
  assert.equal(v.warnings.length, 1);
  assert.equal(validateTrueFalse(createListeningTrueFalse()).errors[0], 'Chưa có câu nào.');
});

test('prompt ảnh dự phòng lấy chủ đề từ tiêu đề và câu', () => {
  const d = createListeningTrueFalse({
    exerciseTitle: 'LISTEN TO A RADIO PROGRAMME ABOUT A TRAVELLER. ARE THE SENTENCES [[TRUE (T)]] OR [[FALSE (F)]]?',
    statements: [{ id: 'a', text: 'Terri went to Istanbul two years ago.' }],
  });
  const p = buildTfImagePrompt(d);
  assert.ok(p.includes('RADIO PROGRAMME ABOUT A TRAVELLER') || p.toLowerCase().includes('traveller'));
  assert.ok(p.includes('Istanbul'));
  assert.ok(!p.includes('[['));
});

test('prompt ảnh từ kế hoạch AI chỉ khi bài cần ảnh', () => {
  const mk = (needs: boolean) => ({ exerciseCount: 1, questionCount: 8, exercises: [{ index: 1, title: 'x', detectedType: 'listening_true_false', questionCount: 8, needsImages: needs, reason: '' }], images: [{ slotId: 'a_b', exerciseIndex: 1, label: '1', subject: 's', prompt: 'A busy spice market in Istanbul', aspectRatio: '4:3', needsReference: false, referenceNote: '', relatedQuestionNumbers: [], answerKeyLabel: '' }] }) as never;
  assert.equal(imagePromptFromPlan(mk(true)), 'A busy spice market in Istanbul');
  assert.equal(imagePromptFromPlan(mk(false)), null);
  assert.equal(imagePromptFromPlan(null), null);
});

test('định dạng chữ và đổi chỗ không sửa bản cũ', () => {
  const s1 = setTfStyle(undefined, 'title', { bold: true });
  const s2 = bumpTfSize(s1, 'title', 12.5, 0.5);
  assert.equal(s1.title?.sizePt, undefined);
  assert.equal(s2.title?.sizePt, 13);
  const list = [1, 2, 3];
  assert.deepEqual(moveTfItem(list, 2, 0), [3, 1, 2]);
  assert.deepEqual(list, [1, 2, 3]);
});
