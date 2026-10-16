import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { validateImagePlan } from '../imagePlanSchema.ts';
import { compareWithParser, applyPlanToExercises, planFromParser, DEFAULT_STYLE_SUFFIX } from '../imagePlanCompare.ts';
import { createJobStore, createJobRunner, planToJobs, type ImageJob, type StorageLike } from '../imageJobs.ts';
import { parseWorksheetText } from '../../smartPasteParser.ts';
import {
  buildGeminiRequest, extractJsonFromGemini, parseAndValidate, checkInput, MAX_INPUT_CHARS,
} from '../../../../../../../../toby-flow-extension/supabase/functions/analyze-worksheet/core.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const FN_DIR = resolve(HERE, '../../../../../../../../toby-flow-extension/supabase/functions/analyze-worksheet');

// ── Bài kiểm thử theo yêu cầu ──
const TEST_TEXT = `PART 2: MATCHING PICTURES & VOCABULARY

A. Coastal Lagoon
B. Alpine Summit
C. Desert Dunes
D. Mangrove Wetland
`;

/** Phản hồi Gemini giả có cấu trúc đúng như responseSchema */
const MOCK_PLAN = {
  exerciseCount: 1,
  questionCount: 0,
  exercises: [
    { index: 1, title: 'PART 2: MATCHING PICTURES & VOCABULARY', detectedType: 'matching_pictures', questionCount: 0, needsImages: true, reason: 'Four lettered picture options to illustrate.' },
  ],
  images: [
    { slotId: 'ex1_pic_A', exerciseIndex: 1, label: 'A', subject: 'Coastal Lagoon', prompt: 'A calm coastal lagoon with shallow water, a sandy bar separating it from the open sea and a few palm trees', aspectRatio: '4:3', needsReference: false, referenceNote: '', relatedQuestionNumbers: [], answerKeyLabel: '' },
    { slotId: 'ex1_pic_B', exerciseIndex: 1, label: 'B', subject: 'Alpine Summit', prompt: 'A rocky snow-capped alpine summit with jagged peaks and a winding mountain trail below', aspectRatio: '4:3', needsReference: false, referenceNote: '', relatedQuestionNumbers: [], answerKeyLabel: '' },
    { slotId: 'ex1_pic_C', exerciseIndex: 1, label: 'C', subject: 'Desert Dunes', prompt: 'Rolling sand dunes in a vast desert with wind-carved ridges and a lone camel in the distance', aspectRatio: '4:3', needsReference: false, referenceNote: '', relatedQuestionNumbers: [], answerKeyLabel: '' },
    { slotId: 'ex1_pic_D', exerciseIndex: 1, label: 'D', subject: 'Mangrove Wetland', prompt: 'A mangrove wetland with tangled aerial roots rising from shallow water and a small heron perched on a branch', aspectRatio: '4:3', needsReference: false, referenceNote: '', relatedQuestionNumbers: [], answerKeyLabel: '' },
  ],
};
const geminiResponse = (obj: unknown, fenced = false) => ({
  candidates: [{ finishReason: 'STOP', content: { parts: [{ text: (fenced ? '```json\n' : '') + JSON.stringify(obj) + (fenced ? '\n```' : '') }] } }],
});

// ───────────────── 1. Schema ─────────────────
test('schema: chấp nhận kế hoạch hợp lệ (4 ảnh, 4 slotId, 4 prompt khác nhau)', () => {
  const r = validateImagePlan(MOCK_PLAN);
  assert.equal(r.ok, true, r.errors.join('; '));
  assert.equal(r.plan!.images.length, 4);
  assert.equal(new Set(r.plan!.images.map((i) => i.slotId)).size, 4);
  assert.equal(new Set(r.plan!.images.map((i) => i.prompt)).size, 4);
});

test('schema: từ chối slotId trùng, prompt trùng, nhãn trùng, exerciseIndex sai, thiếu danh sách, rác', () => {
  const dupSlot = structuredClone(MOCK_PLAN); dupSlot.images[1].slotId = 'ex1_pic_A';
  assert.equal(validateImagePlan(dupSlot).ok, false);
  const dupPrompt = structuredClone(MOCK_PLAN); dupPrompt.images[1].prompt = dupPrompt.images[0].prompt;
  assert.equal(validateImagePlan(dupPrompt).ok, false);
  const badEx = structuredClone(MOCK_PLAN); badEx.images[0].exerciseIndex = 9;
  assert.equal(validateImagePlan(badEx).ok, false);
  const dupLabel = structuredClone(MOCK_PLAN); dupLabel.images[1].label = 'A';
  assert.equal(validateImagePlan(dupLabel).ok, false);
  assert.equal(validateImagePlan({ exercises: [] }).ok, false);
  assert.equal(validateImagePlan('rác').ok, false);
});

test('schema: bản sao trong Edge Function giống hệt bản của web', () => {
  const web = readFileSync(resolve(HERE, '../imagePlanSchema.ts'), 'utf8');
  const fn = readFileSync(resolve(FN_DIR, 'schema.ts'), 'utf8');
  assert.equal(fn, web);
});

// ───────────────── 2. Edge Function (logic thuần) ─────────────────
test('edge: dựng yêu cầu Gemini có schema JSON + chỉ dẫn hệ thống, không chứa khóa', () => {
  const body = buildGeminiRequest(TEST_TEXT) as any;
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.ok(body.generationConfig.responseSchema.properties.images);
  assert.match(body.contents[0].parts[0].text, /Coastal Lagoon/);
  assert.ok(!JSON.stringify(body).includes('AIza'));
});

test('edge: đọc được JSON thuần và JSON bọc ```json; lỗi rõ ràng khi rỗng/bị chặn', () => {
  assert.equal((extractJsonFromGemini(geminiResponse({ a: 1 })) as any).a, 1);
  assert.equal((extractJsonFromGemini(geminiResponse({ a: 2 }, true)) as any).a, 2);
  assert.throws(() => extractJsonFromGemini({ promptFeedback: { blockReason: 'SAFETY' } }), /SAFETY/);
  assert.throws(() => extractJsonFromGemini({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '' }] } }] }), /rỗng/);
  assert.throws(() => extractJsonFromGemini({ candidates: [{ finishReason: 'SAFETY', content: { parts: [] } }] }), /bất thường/);
});

test('edge: parseAndValidate trả kế hoạch hợp lệ từ phản hồi Gemini giả; từ chối đầu vào sai', () => {
  const r = parseAndValidate(geminiResponse(MOCK_PLAN));
  assert.equal(r.ok, true);
  assert.equal(r.plan!.images.length, 4);
  const bad = parseAndValidate(geminiResponse({ ...MOCK_PLAN, images: [], exercises: [] }));
  assert.equal(bad.ok, false);
  assert.equal(checkInput({ text: '   ' }).ok, false);
  assert.equal(checkInput({ text: 'x'.repeat(MAX_INPUT_CHARS + 1) }).ok, false);
  assert.equal(checkInput({ text: 'ok' }).ok, true);
});

// ───────────────── 3. So sánh với parser + áp vào đề ─────────────────
test('parser vs AI: bài kiểm thử khớp 4 ô A–D và cùng dạng bài', () => {
  const parsed = parseWorksheetText(TEST_TEXT);
  const plan = validateImagePlan(MOCK_PLAN).plan!;
  const diffs = compareWithParser(plan, parsed.worksheet.exercises);
  assert.equal(diffs.filter((d) => d.id.startsWith('slots_')).length, 0, JSON.stringify(diffs));
  assert.equal(diffs.filter((d) => d.id.startsWith('type_')).length, 0, JSON.stringify(diffs));
});

test('parser vs AI: phát hiện bất đồng khi AI thêm ảnh E mà parser không có', () => {
  const parsed = parseWorksheetText(TEST_TEXT);
  const p = structuredClone(MOCK_PLAN) as any;
  p.images.push({ ...p.images[0], slotId: 'ex1_pic_E', label: 'E', subject: 'Glacier', prompt: 'A massive glacier flowing between two steep mountain slopes under a clear sky' });
  const plan = validateImagePlan(p).plan!;
  const diffs = compareWithParser(plan, parsed.worksheet.exercises);
  assert.ok(diffs.some((d) => d.id === 'slots_1' && /E/.test(d.message)), JSON.stringify(diffs));
});

test('áp kế hoạch: 4 ô, slotId duy nhất, chủ đề đúng ô (A=Coastal Lagoon ... D=Mangrove Wetland)', () => {
  const parsed = parseWorksheetText(TEST_TEXT);
  const plan = validateImagePlan(MOCK_PLAN).plan!;
  const { exercises, slotMap } = applyPlanToExercises(plan, parsed.worksheet.exercises, 'ws1');
  const slots = exercises[0].imageSlots;
  assert.equal(slots.length, 4);
  assert.equal(new Set(slots.map((s) => s.slotId)).size, 4);
  const byLabel = Object.fromEntries(slots.map((s) => [s.label, s.caption]));
  assert.deepEqual(byLabel, { A: 'Coastal Lagoon', B: 'Alpine Summit', C: 'Desert Dunes', D: 'Mangrove Wetland' });
  assert.equal(slotMap['ex1_pic_C'].slotId, slots.find((s) => s.label === 'C')!.slotId);
});

test('áp kế hoạch: tạo ô còn thiếu khi parser không thấy ô nào', () => {
  const parsed = parseWorksheetText('Exercise 1: Grammar\nChoose the best answer.\n1. He ___ to school.\nA. go\nB. goes\n');
  const plan = validateImagePlan({
    exerciseCount: 1, questionCount: 1,
    exercises: [{ index: 1, title: 'Grammar', detectedType: 'grammar_vocab_multiple_choice', questionCount: 1, needsImages: true, reason: 'x' }],
    images: [{ slotId: 'ex1_pic_1', exerciseIndex: 1, label: '1', subject: 'A boy walking', prompt: 'A boy walking to school with a backpack', aspectRatio: '4:3', needsReference: false, referenceNote: '', relatedQuestionNumbers: [1], answerKeyLabel: '' }],
  }).plan!;
  const { exercises } = applyPlanToExercises(plan, parsed.worksheet.exercises, 'ws2');
  assert.equal(exercises[0].imageSlots.length, 1);
  assert.equal(exercises[0].imageSlots[0].slotId, 'ws2_ex1_pic_1');
});

test('fallback parser: planFromParser tạo kế hoạch hợp lệ từ ô ảnh của parser', () => {
  const parsed = parseWorksheetText(TEST_TEXT);
  const fb = planFromParser(parsed.worksheet.exercises);
  const v = validateImagePlan(fb);
  assert.equal(v.ok, true, v.errors.join('; '));
  assert.equal(fb.images.length, 4);
});

// ───────────────── 4. Job: tạo, chống trùng ─────────────────
const memStorage = (): StorageLike => {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

function buildJobs() {
  const parsed = parseWorksheetText(TEST_TEXT);
  const plan = validateImagePlan(MOCK_PLAN).plan!;
  const { exercises, slotMap } = applyPlanToExercises(plan, parsed.worksheet.exercises, 'ws1');
  let n = 0;
  const jobs = planToJobs({ plan, worksheetId: 'ws1', slotMap, newId: () => `job_${++n}` });
  return { exercises, jobs };
}

test('job: đúng 4 job, 4 prompt khác nhau, 4 slotId duy nhất, mỗi prompt đúng chủ đề + có phong cách chung', () => {
  const { jobs } = buildJobs();
  assert.equal(jobs.length, 4);
  assert.equal(new Set(jobs.map((j) => j.prompt)).size, 4);
  assert.equal(new Set(jobs.map((j) => j.slotId)).size, 4);
  const expectWord: Record<string, RegExp> = { A: /lagoon/i, B: /alpine|summit/i, C: /dunes/i, D: /mangrove/i };
  for (const j of jobs) {
    assert.match(j.prompt, expectWord[j.label]);
    assert.ok(j.prompt.includes(DEFAULT_STYLE_SUFFIX));
    assert.equal(j.status, 'queued');
  }
});

test('job: loại trừ ô bị bỏ chọn; job cần ảnh tham chiếu chờ ở needs_reference', () => {
  const parsed = parseWorksheetText(TEST_TEXT);
  const p = structuredClone(MOCK_PLAN) as any; p.images[0].needsReference = true; p.images[0].referenceNote = 'same cat';
  const plan = validateImagePlan(p).plan!;
  const { slotMap } = applyPlanToExercises(plan, parsed.worksheet.exercises, 'ws1');
  const jobs = planToJobs({ plan, worksheetId: 'ws1', slotMap, excluded: new Set(['ex1_pic_D']) });
  assert.equal(jobs.length, 3);
  assert.equal(jobs[0].status, 'needs_reference');
  assert.equal(jobs[0].generationMode, 'reference_guided');
  const withRef = planToJobs({ plan, worksheetId: 'ws1', slotMap, referenceBySlot: { ex1_pic_A: ['data:image/png;base64,AAA'] } });
  assert.equal(withRef[0].status, 'queued');
});

test('job: chống trùng khi thêm lại cùng kế hoạch', () => {
  const store = createJobStore(memStorage());
  const { jobs } = buildJobs();
  assert.equal(store.addJobs(jobs).added.length, 4);
  const again = buildJobs().jobs.map((j, i) => ({ ...j, jobId: `x${i}` }));
  const r = store.addJobs(again);
  assert.equal(r.added.length, 0);
  assert.equal(r.skipped.length, 4);
  assert.equal(store.getAll().length, 4);
});

// ───────────────── 5. Runner ─────────────────
const fakeResult = (job: ImageJob) => ({ imageUrl: `https://supabase.test/${job.slotId}.png`, storagePath: `Flow/2026-10-13/${job.label}.png`, source: 'supabase' as const });

test('runner: chạy tuần tự đúng thứ tự A→D, không song song, mỗi ảnh về đúng ô', async () => {
  const store = createJobStore(memStorage());
  const { jobs, exercises } = buildJobs();
  store.addJobs(jobs);
  const order: string[] = [];
  let concurrent = 0;
  let maxConcurrent = 0;
  const runner = createJobRunner({
    store,
    sleep: async () => {},
    generate: async (job) => {
      concurrent++; maxConcurrent = Math.max(maxConcurrent, concurrent);
      order.push(job.label);
      await new Promise((r) => setTimeout(r, 5));
      concurrent--;
      return fakeResult(job);
    },
    assign: (job, res) => {
      const slot = exercises[0].imageSlots.find((s) => s.slotId === job.slotId);
      if (!slot) return false;
      slot.assetUrl = res.imageUrl; slot.assetStoragePath = res.storagePath; slot.status = 'assigned'; slot.needsReview = true;
      return true;
    },
  });
  await Promise.all([runner.kick(), runner.kick()]); // gọi trùng không được chạy song song
  assert.deepEqual(order, ['A', 'B', 'C', 'D']);
  assert.equal(maxConcurrent, 1);
  assert.equal(store.getAll().every((j) => j.status === 'done'), true);
  for (const label of ['A', 'B', 'C', 'D']) {
    const slot = exercises[0].imageSlots.find((s) => s.label === label)!;
    assert.equal(slot.status, 'assigned');
    assert.ok(slot.assetUrl!.endsWith(`${slot.slotId}.png`), `ảnh của ô ${label} sai: ${slot.assetUrl}`);
    assert.equal(slot.needsReview, true);
  }
});

test('runner: lỗi tạm thời được thử lại; chạy lại không tạo trùng', async () => {
  const store = createJobStore(memStorage());
  store.addJobs(buildJobs().jobs.slice(0, 2));
  const calls: Record<string, number> = {};
  const runner = createJobRunner({
    store, sleep: async () => {},
    generate: async (job) => {
      calls[job.label] = (calls[job.label] || 0) + 1;
      if (job.label === 'A' && calls.A === 1) throw Object.assign(new Error('Flow lỗi tạm'), { code: 'GENERATE_FAILED' });
      return fakeResult(job);
    },
    assign: () => true,
  });
  await runner.kick();
  assert.equal(calls.A, 2);
  assert.equal(calls.B, 1);
  await runner.kick();
  assert.deepEqual(calls, { A: 2, B: 1 });
  assert.equal(store.getAll().find((j) => j.label === 'A')!.attempts, 2);
});

test('runner: hết số lần thử -> failed + báo lỗi; retry() đưa về hàng đợi', async () => {
  const store = createJobStore(memStorage());
  store.addJobs(buildJobs().jobs.slice(0, 1));
  const runner = createJobRunner({ store, sleep: async () => {}, generate: async () => { throw Object.assign(new Error('hỏng mãi'), { code: 'GENERATE_FAILED' }); }, assign: () => true });
  await runner.kick();
  const j = store.getAll()[0];
  assert.equal(j.status, 'failed');
  assert.equal(j.attempts, 3);
  assert.match(j.error!, /hỏng mãi/);
  store.retry(j.jobId);
  assert.equal(store.getAll()[0].status, 'queued');
  assert.equal(store.getAll()[0].attempts, 0);
});

test('runner: extension không dùng được -> dừng hàng đợi, không đốt lần thử; resume() chạy tiếp', async () => {
  const store = createJobStore(memStorage());
  store.addJobs(buildJobs().jobs);
  let extensionUp = false;
  const runner = createJobRunner({
    store, sleep: async () => {},
    generate: async (job) => {
      if (!extensionUp) throw Object.assign(new Error('Extension không phản hồi'), { code: 'EXTENSION_UNAVAILABLE' });
      return fakeResult(job);
    },
    assign: () => true,
  });
  await runner.kick();
  assert.ok(runner.pausedReason);
  assert.equal(store.getAll().filter((j) => j.status === 'queued').length, 4);
  assert.equal(store.getAll()[0].attempts, 0);
  extensionUp = true;
  await runner.resume();
  assert.equal(store.getAll().every((j) => j.status === 'done'), true);
});

test('runner: gắn ảnh thất bại (ô đã bị xóa) -> job done nhưng có cảnh báo', async () => {
  const store = createJobStore(memStorage());
  store.addJobs(buildJobs().jobs.slice(0, 1));
  const runner = createJobRunner({ store, sleep: async () => {}, generate: async (j) => fakeResult(j), assign: () => false });
  await runner.kick();
  assert.match(store.getAll()[0].error!, /không tìm thấy ô/);
});

// ───────────────── 6. Resume sau khi bị ngắt ─────────────────
test('resume: tải lại trang giữa chừng -> job đang chạy quay lại hàng đợi, job đã xong KHÔNG bị tạo lại', async () => {
  const storage = memStorage();
  const store1 = createJobStore(storage);
  store1.addJobs(buildJobs().jobs);
  const [a, b] = store1.getAll();
  store1.update(a.jobId, { status: 'done', imageUrl: 'https://x/a.png', source: 'supabase' });
  store1.update(b.jobId, { status: 'running', attempts: 1 }); // trang bị đóng đúng lúc này

  const store2 = createJobStore(storage); // "mở lại trang"
  assert.equal(store2.getAll().find((j) => j.jobId === a.jobId)!.status, 'done');
  assert.equal(store2.getAll().find((j) => j.jobId === b.jobId)!.status, 'queued');

  const generated: string[] = [];
  const runner = createJobRunner({ store: store2, sleep: async () => {}, generate: async (j) => { generated.push(j.label); return fakeResult(j); }, assign: () => true });
  await runner.kick();
  assert.deepEqual(generated, ['B', 'C', 'D']);
  assert.equal(store2.addJobs(buildJobs().jobs.map((j, i) => ({ ...j, jobId: `n${i}` }))).added.length, 0);
});

test('resume: job cần ảnh tham chiếu mất ảnh sau khi tải lại -> needs_reference, bổ sung xong thì chạy được', () => {
  const storage = memStorage();
  const s1 = createJobStore(storage);
  const parsed = parseWorksheetText(TEST_TEXT);
  const p = structuredClone(MOCK_PLAN) as any; p.images[0].needsReference = true;
  const plan = validateImagePlan(p).plan!;
  const { slotMap } = applyPlanToExercises(plan, parsed.worksheet.exercises, 'ws1');
  s1.addJobs(planToJobs({ plan, worksheetId: 'ws1', slotMap, referenceBySlot: { ex1_pic_A: ['data:image/png;base64,AAA'] } }));
  assert.equal(s1.getAll()[0].status, 'queued');
  const s2 = createJobStore(storage);
  assert.equal(s2.getAll()[0].status, 'needs_reference');
  s2.setReferences(s2.getAll()[0].jobId, ['data:image/png;base64,BBB']);
  assert.equal(s2.getAll()[0].status, 'queued');
});
