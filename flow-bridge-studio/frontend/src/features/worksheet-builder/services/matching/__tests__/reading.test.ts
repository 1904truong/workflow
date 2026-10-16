import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMatchingText, matchingFromParsed } from '../matchingCore.ts';

const SAMPLE = `1 READ THE TEXT THEN MATCH THE SENTENCES 1-6 TO PLACES A-B
GHOST TOWNS:
Ghost towns ... why did people live there? Why did they leave?
Read about two unloved places from around the world ...
Name: Kowloon Walled City    Location: China
Then: Hundreds of years ago, it was a Chinese fort and only soldiers lived
there. Then in the early 20th century, the soldiers left.
Why did people go there? There were no laws and no police in the city.
Why did people leave? In 1993, the government finally moved people out.
Now: One building and the city gate are left.
Name: Craco
Location: Italy
Then: The historic town of Craco is hundreds of years old.
Now: Craco is falling apart.
1. There was a lot of pollution.   ☐   A. Kowloon Walled City
2. People in the town were religious.   B. Craco
3. There wasn't any light.
4. There was a lot of crime.
5. There were farms near the town.
6. People left because of natural and man-made disasters.`;

test('Smart Paste bài đọc có ảnh: tách khối Name/Location, câu và lựa chọn', () => {
  const r = parseMatchingText(SAMPLE);
  assert.equal(r.ok, true);
  assert.equal(r.title, 'READ THE TEXT THEN MATCH THE SENTENCES 1-6 TO PLACES A-B');
  assert.equal(r.readingHeading, 'GHOST TOWNS:');
  assert.equal(r.readingIntro?.split('\n').length, 2);
  assert.equal(r.reading?.length, 2);
  assert.equal(r.reading![0].name, 'Kowloon Walled City');
  assert.equal(r.reading![0].location, 'China');
  assert.equal(r.reading![1].location, 'Italy');
  assert.equal(r.reading![0].text.split('\n\n').length, 4);
  assert.ok(r.reading![0].text.startsWith('**Then:**'));
  assert.equal(r.problems.length, 6);
  assert.deepEqual(r.solutions, ['Kowloon Walled City', 'Craco']);
  assert.equal(matchingFromParsed(r).layout, 'reading_images');
});

test('Smart Paste: xuống dòng mềm của Word (\\v, U+2028) và NBSP vẫn tách đúng', () => {
  const messy = SAMPLE.replace(/\n/g, (_m, i: number) => (i % 3 === 0 ? '\u2028' : i % 3 === 1 ? '\v' : '\r\n')).replace(/ /g, (m, i: number) => (i % 7 === 0 ? '\u00a0' : m));
  const r = parseMatchingText(messy);
  assert.equal(r.ok, true);
  assert.equal(r.readingHeading, 'GHOST TOWNS:');
  assert.equal(r.reading?.length, 2);
  assert.equal(r.problems.length, 6);
  assert.deepEqual(r.solutions, ['Kowloon Walled City', 'Craco']);
});

test('Smart Paste: công thức LaTeX bị dọn (km², ô vuông)', () => {
  const withLatex = SAMPLE
    .replace('Then: Hundreds of years ago', 'Then: In 1980, the \\(0.03\\text{ km}^2\\) city had 500 buildings. Hundreds of years ago')
    .replace('6. People left because of natural and man-made disasters.', '6. People left because of natural and man-made disasters. \\(\\Box \\)');
  const r = parseMatchingText(withLatex);
  assert.ok(r.reading![0].text.includes('0.03 km²'));
  assert.ok(!r.reading![0].text.includes('\\('));
  assert.equal(r.problems[5], 'People left because of natural and man-made disasters.');
});
