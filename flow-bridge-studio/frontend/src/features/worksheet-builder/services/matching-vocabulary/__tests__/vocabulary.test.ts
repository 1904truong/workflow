import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseVocabularyText, parseVocabularyPairs, createMatchingVocabulary, definitionLabel, validateVocabulary,
  moveVocabItem, setVocabStyle, bumpVocabSize, shuffleItems, autoParseVocabulary, decideVocabLayout, VOCAB_LAYOUTS,
} from '../matchingVocabularyCore.ts';

test('Smart Paste: tách từ (1., 2.) và định nghĩa (a., b.)', () => {
  const r = parseVocabularyText(`MATCH EACH WORD WITH ITS DEFINITION
1. Residents
2. Crowded
3. Narrow
a. the people who rule a country or state
b. containing a lot of people or things
c. a small distance form side to side`);
  assert.equal(r.ok, true);
  assert.equal(r.title, 'MATCH EACH WORD WITH ITS DEFINITION');
  assert.deepEqual(r.words, ['Residents', 'Crowded', 'Narrow']);
  assert.equal(r.definitions.length, 3);
});

test('Import cặp từ – định nghĩa với nhiều kiểu dấu phân tách', () => {
  const r = parseVocabularyPairs('1. Residents - people who live in a place\nCrowded: full of people\nNarrow = a small distance side to side\nlỗi dòng này', false);
  assert.deepEqual(r.words, ['Residents', 'Crowded', 'Narrow']);
  assert.equal(r.definitions[1], 'full of people');
  assert.equal(r.warnings.length, 1);
});

test('Import có xáo trộn: định nghĩa đổi thứ tự nhưng vẫn đủ', () => {
  const seq = [0.9, 0.1, 0.5];
  let i = 0;
  const r = parseVocabularyPairs('a - one\nb - two\nc - three\nd - four', true, () => seq[i++ % seq.length]);
  assert.deepEqual([...r.definitions].sort(), ['four', 'one', 'three', 'two']);
  assert.notDeepEqual(r.definitions, ['one', 'two', 'three', 'four']);
});

test('nhãn definition a..z rồi aa', () => {
  assert.equal(definitionLabel(0), 'a');
  assert.equal(definitionLabel(25), 'z');
  assert.equal(definitionLabel(26), 'aa');
});

test('createMatchingVocabulary bù cài đặt mặc định', () => {
  const d = createMatchingVocabulary({ settings: { fontSizePt: 14 } as never });
  assert.equal(d.settings.fontSizePt, 14);
  assert.equal(d.settings.showAnswerBoxes, true);
});

test('validate bắt mục trống và thiếu định nghĩa', () => {
  const d = createMatchingVocabulary({ words: [{ id: 'w1', text: 'a' }, { id: 'w2', text: '' }], definitions: [{ id: 'd1', text: 'x' }] });
  const v = validateVocabulary(d);
  assert.equal(v.errors.length, 1);
  assert.equal(v.warnings.length, 1);
});

test('đổi chỗ, định dạng và cỡ chữ không sửa bản cũ', () => {
  const list = [1, 2, 3];
  assert.deepEqual(moveVocabItem(list, 0, 2), [2, 3, 1]);
  assert.deepEqual(list, [1, 2, 3]);
  const s1 = setVocabStyle(undefined, 'words', { bold: true });
  const s2 = bumpVocabSize(s1, 'words', 12, 0.5);
  assert.equal(s1.words?.sizePt, undefined);
  assert.equal(s2.words?.sizePt, 12.5);
  assert.deepEqual(shuffleItems([1, 2, 3], () => 0).sort(), [1, 2, 3]);
});

test('autoParse: tự nhận dạng kiểu đánh số hoặc kiểu cặp', () => {
  const a = autoParseVocabulary('1. Residents\n2. Crowded\na. people who live in a place\nb. full of people');
  assert.equal(a.method, 'numbered');
  assert.equal(a.words.length, 2);
  const b = autoParseVocabulary('Residents - people who live in a place\nCrowded - full of people');
  assert.equal(b.method, 'pairs');
  assert.equal(b.words.length, 2);
  const c = autoParseVocabulary('chỉ là một đoạn văn bình thường');
  assert.equal(c.ok, false);
  assert.equal(c.method, 'none');
});

test('decideVocabLayout: chọn layout có ảnh nếu AI cần ảnh và có layout như vậy, ngược lại giữ layout', () => {
  const plan = { exerciseCount: 1, questionCount: 2, exercises: [{ index: 1, title: 'x', detectedType: 'matching_vocabulary', questionCount: 2, needsImages: true, reason: 'cần ảnh' }], images: [{ slotId: 'a_b', exerciseIndex: 1, label: 'A', subject: 's', prompt: 'long enough prompt', aspectRatio: '4:3', needsReference: false, referenceNote: '', relatedQuestionNumbers: [], answerKeyLabel: '' }] } as never;
  assert.equal(decideVocabLayout(plan, 'two_columns').layout, 'two_columns');
  const layouts = [...VOCAB_LAYOUTS, { id: 'with_images' as never, label: 'Có ảnh', desc: '', supportsImages: true }];
  assert.equal(decideVocabLayout(plan, 'two_columns', layouts).layout, 'with_images');
  assert.equal(decideVocabLayout(null, 'two_columns').layout, 'two_columns');
});
