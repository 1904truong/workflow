import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMatchingText, matchingFromParsed, createMatching, removeSolution, removeProblem,
  moveItem, duplicateProblem, validateMatching, solutionLabel,
} from '../matchingCore.ts';

const SAMPLE = `MATCH THE PROBLEM TO ITS SOLUTIONS.

1. Litter in streets
2. Complain about the kids
3. Cars and drivers

a. Creating more things for the young to do
b. Educating people quickly
c. Getting more speed cameras
d. Opening more places for the young to go
e. Putting litter bins and billboards "Don't drop it"
f. Stop the fast drivers from driving in town
g. Punish people`;

test('smart paste: tách tiêu đề, 3 problem và 7 solution', () => {
  const r = parseMatchingText(SAMPLE);
  assert.equal(r.ok, true);
  assert.equal(r.title, 'MATCH THE PROBLEM TO ITS SOLUTIONS.');
  assert.deepEqual(r.problems, ['Litter in streets', 'Complain about the kids', 'Cars and drivers']);
  assert.equal(r.solutions.length, 7);
  assert.equal(r.solutions[4], 'Putting litter bins and billboards "Don\'t drop it"');
  assert.deepEqual(r.warnings, []);
  const d = matchingFromParsed(r);
  assert.equal('answerKey' in d, false);
  assert.equal(d.problems.length, 3);
  assert.equal(new Set([...d.problems, ...d.solutions].map((x) => x.id)).size, 10);
});

test('smart paste: dòng dài bị ngắt xuống dòng được nối vào mục trước', () => {
  const r = parseMatchingText('MATCH\n1. A very long problem\nthat continues here\n2. Short\na. first\nb. second\nstill second');
  assert.equal(r.problems[0], 'A very long problem that continues here');
  assert.equal(r.solutions[1], 'second still second');
});

test('smart paste: thiếu cột solutions -> không ok và có cảnh báo, giữ nguyên dữ liệu', () => {
  const r = parseMatchingText('MATCH\n1. one\n2. two');
  assert.equal(r.ok, false);
  assert.ok(r.warnings.some((w) => w.includes('Solutions')));
  assert.equal(r.problems.length, 2);
});

test('smart paste: nhãn chữ cái lệch -> cảnh báo nhưng vẫn đánh lại a,b,c', () => {
  const r = parseMatchingText('1. x\na. one\nc. three');
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some((w) => w.startsWith('Chữ cái')));
});

test('nhãn solution: a..z rồi aa', () => {
  assert.equal(solutionLabel(0), 'a');
  assert.equal(solutionLabel(25), 'z');
  assert.equal(solutionLabel(26), 'aa');
});

test('createMatching: cài đặt thiếu trường được bù mặc định', () => {
  const d = createMatching({ settings: { fontSizePt: 13 } as any });
  assert.equal(d.settings.fontSizePt, 13);
  assert.equal(d.settings.lineSpacing, 'normal');
  assert.equal(d.layout, 'two_columns');
});

test('mười problem, mười hai solution, mục dài vẫn tách đúng', () => {
  const lines = ['MATCH'];
  for (let i = 1; i <= 10; i++) lines.push(`${i}. ${'very long text '.repeat(8)}${i}`);
  for (let i = 0; i < 12; i++) lines.push(`${solutionLabel(i)}. solution ${i}`);
  const r = parseMatchingText(lines.join('\n'));
  assert.equal(r.problems.length, 10);
  assert.equal(r.solutions.length, 12);
  assert.deepEqual(r.warnings, []);
});

test('đổi chỗ, nhân bản, xóa mục không làm hỏng danh sách', () => {
  let d = matchingFromParsed(parseMatchingText(SAMPLE));
  d = { ...d, solutions: moveItem(d.solutions, 1, 5) };
  assert.equal(d.solutions[5].text, 'Educating people quickly');
  d = duplicateProblem(d, d.problems[0].id);
  assert.equal(d.problems.length, 4);
  assert.notEqual(d.problems[0].id, d.problems[1].id);
  assert.equal(d.problems[1].text, d.problems[0].text);
  d = removeProblem(d, d.problems[0].id);
  d = removeSolution(d, d.solutions[0].id);
  assert.equal(d.problems.length, 3);
  assert.equal(d.solutions.length, 6);
});

test('validate: 3 problem + 7 solution hợp lệ, không có cảnh báo về đáp án', () => {
  const v = validateMatching(matchingFromParsed(parseMatchingText(SAMPLE)));
  assert.deepEqual(v.errors, []);
  assert.deepEqual(v.warnings, []);
});

test('validate: bắt mục trống và ID trùng', () => {
  let d = matchingFromParsed(parseMatchingText(SAMPLE));
  d.problems[1] = { ...d.problems[1], text: '  ' };
  d.solutions[1] = { ...d.solutions[1], id: d.solutions[0].id };
  const v = validateMatching(d);
  assert.ok(v.errors.some((e) => e.includes('Problem 2')));
  assert.ok(v.errors.some((e) => e.includes('trùng')));
});

test('smart paste: tự nhận diện layout facing_tables khi tiêu đề có "DRAW LINES AND MATCH"', () => {
  const text = `DRAW LINES AND MATCH

1. When's Tom's birthday?
2. How are you?

a. I'm ten.
b. It's my brother. Nick.`;
  const parsed = parseMatchingText(text);
  assert.equal(parsed.ok, true);
  const data = matchingFromParsed(parsed);
  assert.equal(data.layout, 'facing_tables');
  assert.equal(data.problems.length, 2);
  assert.equal(data.solutions.length, 2);
});

