import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTableText, splitBullets, splitCellLine, countBlanks, insertRow, deleteRow, insertColumn, deleteColumn, setCell, setHeader,
  createListeningTable, validateListeningTable, buildTableImagePrompt, imagePromptFromPlan, createEmptyTable,
} from '../listeningTableCore.ts';

const SAMPLE = `1 LISTEN AND FILL IN THE TABLE. THEN ANSWER THE QUESTIONS BELOW.
Place\tAdvantages\tDisadvantages
Town centre\t-Near good (1) __________\t-Buildings are (2) __________ and (3) __________ -Cold in winter -Hot in summer
Park\t-Quiet -Not far from big roads\t-Far from the (4) __________
Train Station\t-Good for travel\t-Buildings aren't (5) __________
1. Are the windows going to be big or small?   __________
2. Are the walls going to be blue or yellow?
3. Which place is chosen?`;

test('tách tiêu đề, bảng (Tab), và câu hỏi', () => {
  const r = parseTableText(SAMPLE);
  assert.equal(r.ok, true);
  assert.equal(r.title, 'LISTEN AND FILL IN THE TABLE. THEN ANSWER THE QUESTIONS BELOW.');
  assert.deepEqual(r.table!.columns, ['Place', 'Advantages', 'Disadvantages']);
  assert.equal(r.table!.rows.length, 3);
  assert.equal(r.table!.rows[1].cells[1], '-Quiet\n-Not far from big roads');
  assert.equal(r.table!.rows[0].cells[2].split('\n').length, 3);
  assert.deepEqual(r.questions, ['Are the windows going to be big or small?', 'Are the walls going to be blue or yellow?', 'Which place is chosen?']);
  assert.equal(countBlanks(r.table!), 5);
});

test('bảng phân tách bằng | cũng được nhận', () => {
  const r = parseTableText('TITLE\n| Word | Meaning |\n| a | b (1) ____ |\n1. Q?');
  assert.equal(r.ok, true);
  assert.deepEqual(r.table!.columns, ['Word', 'Meaning']);
  assert.equal(r.questions.length, 1);
});

test('không có bảng -> không ok', () => {
  assert.equal(parseTableText('chỉ có một dòng văn bản').ok, false);
});

test('gạch đầu dòng chỉ tách khi có khoảng trắng đứng trước', () => {
  assert.equal(splitBullets('-Quiet -Near well-known roads'), '-Quiet\n-Near well-known roads');
});

test('chia dòng ô thành chữ và chỗ trống đánh số', () => {
  const parts = splitCellLine('-Near good (1) __________ x');
  assert.deepEqual(parts.map((p) => p.type), ['text', 'blank', 'text']);
  assert.equal(parts[1].label, '1');
});

test('thêm/xóa hàng cột không sửa bản cũ và giữ tối thiểu', () => {
  const t = createEmptyTable(3, 2);
  const t2 = insertRow(t, 0);
  assert.equal(t.rows.length, 2);
  assert.equal(t2.rows.length, 3);
  assert.equal(deleteRow(createEmptyTable(3, 1), 0).rows.length, 1);
  const t3 = insertColumn(t, 0);
  assert.equal(t3.columns.length, 4);
  assert.equal(t3.rows[0].cells.length, 4);
  assert.equal(deleteColumn(createEmptyTable(2, 1), 0).columns.length, 2);
  assert.equal(deleteColumn(t3, 1).columns.length, 3);
  assert.equal(setCell(t, 0, 1, 'x').rows[0].cells[1], 'x');
  assert.equal(setHeader(t, 0, 'Z').columns[0], 'Z');
});

test('validate và prompt ảnh', () => {
  const d = createListeningTable();
  assert.equal(validateListeningTable(d).errors[0], 'Bảng chưa có nội dung.');
  const d2 = createListeningTable({ table: { columns: ['Place', 'A', 'B'], rows: [{ id: 'r', cells: ['Park', 'x', 'y'] }, { id: 's', cells: ['Train Station', '', ''] }] } });
  assert.ok(buildTableImagePrompt(d2).includes('Park, Train Station'));
  const plan = { exerciseCount: 1, questionCount: 5, exercises: [{ index: 1, title: 'x', detectedType: 'listening_table_completion', questionCount: 5, needsImages: true, reason: '' }], images: [{ slotId: 'a_b', exerciseIndex: 1, label: 'A', subject: 's', prompt: 'A town map with a station and park', aspectRatio: '4:3', needsReference: false, referenceNote: '', relatedQuestionNumbers: [], answerKeyLabel: '' }] } as never;
  assert.equal(imagePromptFromPlan(plan), 'A town map with a station and park');
  assert.equal(imagePromptFromPlan(null), null);
});
