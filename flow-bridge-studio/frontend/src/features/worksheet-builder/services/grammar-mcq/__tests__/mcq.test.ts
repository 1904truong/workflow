import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMcqText, createGrammarMcq, newQuestion, optionLabel, resolveOptionColumns, splitBlanks, validateGrammarMcq,
  shuffleOptionsOf, moveMcq, setMcqStyle, bumpMcqSize,
} from '../grammarMcqCore.ts';

const SAMPLE = `1 CHOOSE THE CORRECT ANSWER.
1. When I got home I found that water ________ down the kitchen walls.
a. ran b. was running c. has run d. had been running
2. After he ________ his English course, he went to England to continue his study.
a. has finish
b. had finished
c. was finished
d. would finish
3. How ________ since we ________ college?
a. are you / left b. have you been / have left c. were you / left d. have you been / left`;

test('tách tiêu đề, câu hỏi và lựa chọn (cùng dòng hoặc từng dòng)', () => {
  const r = parseMcqText(SAMPLE);
  assert.equal(r.ok, true);
  assert.equal(r.title, 'CHOOSE THE CORRECT ANSWER.');
  assert.equal(r.questions.length, 3);
  assert.equal(r.questions[0].options.length, 4);
  assert.deepEqual(r.questions[0].options, ['ran', 'was running', 'has run', 'had been running']);
  assert.deepEqual(r.questions[1].options, ['has finish', 'had finished', 'was finished', 'would finish']);
  assert.equal(r.questions[2].options[1], 'have you been / have left');
});

test('câu không có lựa chọn vẫn được nhận, báo cảnh báo khi lẫn lộn', () => {
  const r = parseMcqText('1. A ________ b\na. x b. y\n2. C ________ d');
  assert.equal(r.questions.length, 2);
  assert.equal(r.questions[1].options.length, 0);
  assert.equal(r.warnings.length, 1);
  assert.equal(parseMcqText('không có câu nào').ok, false);
});

test('nhãn lựa chọn, số cột tự động, tách chỗ trống', () => {
  assert.equal(optionLabel(0), 'a');
  assert.equal(optionLabel(3, 'uppercase'), 'D');
  const short = newQuestion('x'); short.options.forEach((o, i) => { o.text = ['ran', 'was', 'has', 'had'][i]; });
  assert.equal(resolveOptionColumns(short, 'auto'), 4);
  const long = newQuestion('x'); long.options.forEach((o) => { o.text = 'had been running for hours'; });
  assert.equal(resolveOptionColumns(long, 'auto'), 2);
  assert.equal(resolveOptionColumns(long, 1), 1);
  assert.deepEqual(splitBlanks('a ____ b').map((p) => p.type), ['text', 'blank', 'text']);
});

test('validate, đổi thứ tự, trộn lựa chọn, định dạng', () => {
  const d = createGrammarMcq({ questions: [newQuestion('') ] });
  const v = validateGrammarMcq(d);
  assert.equal(v.errors.length, 1);
  assert.equal(validateGrammarMcq(createGrammarMcq()).errors[0], 'Chưa có câu hỏi nào.');
  assert.deepEqual(moveMcq([1, 2, 3], 0, 2), [2, 3, 1]);
  const q = newQuestion('x'); q.options.forEach((o, i) => { o.text = String(i); });
  const sh = shuffleOptionsOf(q, () => 0);
  assert.deepEqual(sh.options.map((o) => o.text).sort(), ['0', '1', '2', '3']);
  assert.equal(q.options[0].text, '0');
  const s1 = setMcqStyle(undefined, 'questions', { bold: true });
  assert.equal(bumpMcqSize(s1, 'questions', 10.5, 0.5).questions?.sizePt, 11);
});

test('đề nghe Omar: tiêu đề + dòng giải thích, lựa chọn không có dấu chấm, nhiều lựa chọn trên một dòng', () => {
  const p = parseMcqText(`LISTEN AND CHOOSE THE CORRECT ANSWER
You will hear an interview with a young pilot called Omar.
1. Omar first became interested in flying planes when
a he first went on an aeroplane.
b he moved to a house near an airport.
c he played with his toy aeroplanes.
2. Where did Omar's family move to after living next to the airport?
a to a town b to a city c to a village
3. How did Omar learn to fly?
a His father taught him.
b He took flying lessons.
c He took a university course.`);
  assert.equal(p.title, 'LISTEN AND CHOOSE THE CORRECT ANSWER');
  assert.equal(p.instruction, 'You will hear an interview with a young pilot called Omar.');
  assert.equal(p.questions.length, 3);
  assert.deepEqual(p.questions[0].options, ['he first went on an aeroplane.', 'he moved to a house near an airport.', 'he played with his toy aeroplanes.']);
  assert.deepEqual(p.questions[1].options, ['to a town', 'to a city', 'to a village']);
  assert.equal(p.questions[2].options.length, 3);
});
