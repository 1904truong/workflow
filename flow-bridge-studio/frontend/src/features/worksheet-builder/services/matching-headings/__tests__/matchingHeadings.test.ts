import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHeadingsText, ideaLabel, validateHeadings, createMatchingHeadings } from '../matchingHeadingsCore.ts';

const TEXT = `MATCH EACH PARAGRAPH WITH ITS MAIN IDEA
HAVING A SAY ABOUT YOUR CITY
Urban activist Alessandra Orofino is from a big city.

Cities are growing because of all the benefits they offer.

According to Orofino, people are disconnected.

1. Paragraph 1  a. People are becoming disconnected from their cities.
2. Paragraph 2  b. As cities grow, there are fewer close communities.
3. Paragraph 3
c. Cities around the world are growing.
d. Cities have good points,
but they also have problems.`;

test('tách tiêu đề, đoạn văn và ý chính', () => {
  const p = parseHeadingsText(TEXT);
  assert.equal(p.ok, true);
  assert.equal(p.exerciseTitle, 'MATCH EACH PARAGRAPH WITH ITS MAIN IDEA');
  assert.equal(p.passageTitle, 'HAVING A SAY ABOUT YOUR CITY');
  assert.equal(p.paragraphs.length, 3);
  assert.equal(p.ideas.length, 4);
  assert.equal(p.ideas[3], 'Cities have good points, but they also have problems.');
});

test('thiếu ý chính thì không ok', () => {
  assert.equal(parseHeadingsText('Một đoạn văn thôi.').ok, false);
});

test('nhãn a, z, aa và kiểm tra dữ liệu', () => {
  assert.equal(ideaLabel(0), 'a');
  assert.equal(ideaLabel(26), 'aa');
  assert.ok(validateHeadings(createMatchingHeadings()).errors.length >= 2);
});
