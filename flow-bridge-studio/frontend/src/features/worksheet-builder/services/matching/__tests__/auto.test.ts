import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMatchingText, matchingFromParsed, createMatching } from '../matchingCore.ts';
import { decideLayout, planTargets, runAutoImages, finalPrompt, buildLocalPrompt, PHOTO_STYLE } from '../autoMatching.ts';
import type { AiImagePlan } from '../../ai/imagePlanSchema.ts';

const TEXT = `GHOST TOWNS:
Name: Kowloon Walled City    Location: China
Then: Hundreds of years ago, it was a Chinese fort and only soldiers lived there.
Name: Craco
Location: Italy
Then: The historic town of Craco is hundreds of years old.
1. There was a lot of pollution.   A. Kowloon Walled City
2. People in the town were religious.   B. Craco`;

const plan = (images: Partial<AiImagePlan['images'][number]>[], needsImages = true): AiImagePlan => ({
  exerciseCount: 1,
  questionCount: 2,
  exercises: [{ index: 1, title: 'Ex', detectedType: 'matching_information', questionCount: 2, needsImages, reason: 'Mỗi địa điểm cần một ảnh' }],
  images: images.map((im, i) => ({
    slotId: `ex1_pic_${i}`, exerciseIndex: 1, label: String.fromCharCode(65 + i), subject: `s${i}`, prompt: `prompt number ${i} long enough`,
    aspectRatio: '4:3', needsReference: false, referenceNote: '', relatedQuestionNumbers: [], answerKeyLabel: '', ...im,
  })),
});

test('bài đọc có Name/Location -> tự chọn Reading + Images', () => {
  const parsed = parseMatchingText(TEXT);
  assert.equal(decideLayout(parsed, null, 'two_columns').layout, 'reading_images');
});

test('không có bài đọc: AI nói cần ảnh -> Image Matching, không cần ảnh -> giữ layout', () => {
  const parsed = parseMatchingText('MATCH\n1. one\n2. two\na. x\nb. y');
  assert.equal(decideLayout(parsed, plan([{}]), 'two_columns').layout, 'image_matching');
  assert.equal(decideLayout(parsed, plan([], false), 'answer_table').layout, 'answer_table');
  assert.equal(decideLayout(parsed, null, 'two_columns').layout, 'two_columns');
});

test('planTargets: ghép prompt AI theo tên địa điểm, thiếu thì tự sinh từ nội dung', () => {
  const data = matchingFromParsed(parseMatchingText(TEXT));
  const withPlan = planTargets(data, plan([
    { subject: 'Craco hill town', prompt: 'Hilltop ghost town Craco in Italy at sunset' },
    { subject: 'Kowloon Walled City', prompt: 'Dense Kowloon Walled City in Hong Kong' },
  ]));
  assert.equal(withPlan.length, 2);
  assert.ok(withPlan[0].prompt.includes('Kowloon'));
  assert.ok(withPlan[1].prompt.includes('Craco'));
  assert.equal(withPlan[0].style, 'photo');

  const noPlan = planTargets(data, null);
  assert.equal(noPlan.length, 2);
  assert.ok(noPlan[0].prompt.startsWith('Kowloon Walled City, China'));
  assert.ok(finalPrompt(noPlan[0]).includes(PHOTO_STYLE));
});

test('planTargets bỏ qua khối đã có ảnh', () => {
  const data = matchingFromParsed(parseMatchingText(TEXT));
  data.reading![0].imageUrl = 'https://x/y.jpg';
  assert.equal(planTargets(data, null).length, 1);
});

test('Image Matching: gắn prompt theo số câu liên quan hoặc nhãn solution', () => {
  const base = createMatching({
    layout: 'image_matching',
    problems: [{ id: 'p1', text: 'a' }, { id: 'p2', text: 'b' }],
    solutions: [{ id: 's1', text: 'x' }, { id: 's2', text: 'y' }],
  });
  const t = planTargets(base, plan([{ relatedQuestionNumbers: [2], label: 'A' }, { label: 'b' }]));
  assert.deepEqual(t.map((x) => [x.kind, x.id]), [['problem', 'p2'], ['solution', 's2']]);
  assert.equal(t[0].style, 'line_art');
});

test('runAutoImages: gắn từng ảnh khi xong, ảnh lỗi không chặn ảnh sau', async () => {
  let data = matchingFromParsed(parseMatchingText(TEXT));
  const targets = planTargets(data, null);
  let calls = 0;
  const progress: string[] = [];
  const items = await runAutoImages({
    targets,
    getValue: () => data,
    apply: (n) => { data = n; },
    generate: async () => {
      calls += 1;
      if (calls === 1) throw new Error('hết hạn mức');
      return { imageUrl: 'https://img/2.jpg' };
    },
    onProgress: (it) => progress.push(it.map((x) => x.status[0]).join('')),
    isCancelled: () => false,
  });
  assert.deepEqual(items.map((i) => i.status), ['failed', 'done']);
  assert.equal(items[0].error, 'hết hạn mức');
  assert.equal(data.reading![0].imageUrl, undefined);
  assert.equal(data.reading![1].imageUrl, 'https://img/2.jpg');
  assert.equal(progress[0], 'qq');
});

test('runAutoImages dừng khi bị hủy', async () => {
  let data = matchingFromParsed(parseMatchingText(TEXT));
  let cancelled = false;
  let calls = 0;
  await runAutoImages({
    targets: planTargets(data, null),
    getValue: () => data,
    apply: (n) => { data = n; },
    generate: async () => { calls += 1; cancelled = true; return { imageUrl: 'u' }; },
    onProgress: () => {},
    isCancelled: () => cancelled,
  });
  assert.equal(calls, 1);
  assert.equal(data.reading![0].imageUrl, undefined);
});

test('buildLocalPrompt bỏ ký hiệu in đậm và lấy câu đầu', () => {
  const p = buildLocalPrompt('Craco', 'Italy', '**Then:** The historic town is old. It had a castle.');
  assert.ok(p.startsWith('Craco, Italy.'));
  assert.ok(!p.includes('**'));
  assert.ok(p.includes('The historic town is old.'));
});
