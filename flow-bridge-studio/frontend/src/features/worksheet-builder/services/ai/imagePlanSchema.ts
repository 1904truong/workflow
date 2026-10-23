// Kế hoạch ảnh do AI (Gemini) sinh ra từ nội dung bài tập + bộ kiểm tra JSON.
// FILE NÀY KHÔNG IMPORT GÌ: được dùng chung cho web và Supabase Edge Function.
// Bản sao cho Edge Function: toby-flow-extension/supabase/functions/analyze-worksheet/schema.ts
// (có test kiểm tra hai file giống hệt nhau — sửa một nơi phải sửa cả hai).

export const AI_EXERCISE_TYPES = [
  'listening_gap_fill',
  'listening_multiple_choice',
  'listening_true_false',
  'listening_matching',
  'listening_table_completion',
  'reading_multiple_choice',
  'true_false_not_given',
  'reading_short_answer',
  'reading_comic',
  'matching_headings',
  'matching_information',
  'draw_lines_match',
  'matching_vocabulary',
  'matching_pictures',
  'grammar_vocab_multiple_choice',
  'gap_filling_word_formation',
  'sentence_rearrangement',
  'sentence_construction',
  'other',
] as const;

export type AiExerciseType = (typeof AI_EXERCISE_TYPES)[number];
export type AiAspectRatio = '1:1' | '4:3' | '16:9' | '3:4';
export const AI_ASPECT_RATIOS: AiAspectRatio[] = ['1:1', '4:3', '16:9', '3:4'];

export interface AiExercisePlan {
  /** Thứ tự bài trong văn bản dán vào, bắt đầu từ 1 */
  index: number;
  title: string;
  detectedType: AiExerciseType;
  questionCount: number;
  needsImages: boolean;
  /** Lý do cần / không cần ảnh (để giáo viên hiểu) */
  reason: string;
}

export interface AiImagePlanItem {
  /** Mã ô ảnh duy nhất trong cả đề, ví dụ "ex2_pic_A" */
  slotId: string;
  /** Bài tập chứa ô ảnh (1-based, khớp AiExercisePlan.index) */
  exerciseIndex: number;
  /** Nhãn ô ảnh trong bài (A, B, C... hoặc 1, 2...) */
  label: string;
  /** Chủ thể cần vẽ, ngắn gọn (vd "Coastal Lagoon") */
  subject: string;
  /** Prompt tiếng Anh riêng cho ảnh này (chưa gồm phần phong cách chung) */
  prompt: string;
  aspectRatio: AiAspectRatio;
  needsReference: boolean;
  referenceNote: string;
  /** Số thứ tự các câu hỏi liên quan tới ảnh (giữ đúng thứ tự gốc) */
  relatedQuestionNumbers: number[];
  /** Đáp án đúng gắn với ảnh này nếu đề có (vd câu 8 → "A") */
  answerKeyLabel: string;
}

export interface AiImagePlan {
  exerciseCount: number;
  questionCount: number;
  exercises: AiExercisePlan[];
  images: AiImagePlanItem[];
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  plan?: AiImagePlan;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const normPrompt = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Kiểm tra + chuẩn hóa JSON trả về từ AI. Lỗi nghiêm trọng -> ok=false; cảnh báo vẫn dùng được. */
export function validateImagePlan(input: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isObj(input)) return { ok: false, errors: ['Kết quả AI không phải một đối tượng JSON'], warnings };
  if (!Array.isArray(input.exercises)) errors.push('Thiếu danh sách "exercises"');
  if (!Array.isArray(input.images)) errors.push('Thiếu danh sách "images"');
  if (errors.length) return { ok: false, errors, warnings };

  const exercises: AiExercisePlan[] = [];
  (input.exercises as unknown[]).forEach((raw, i) => {
    if (!isObj(raw)) { errors.push(`exercises[${i}] không hợp lệ`); return; }
    const index = Number(raw.index);
    const type = str(raw.detectedType) as AiExerciseType;
    if (!Number.isInteger(index) || index < 1) { errors.push(`exercises[${i}].index phải là số nguyên ≥ 1`); return; }
    if (!(AI_EXERCISE_TYPES as readonly string[]).includes(type)) {
      warnings.push(`Bài ${index}: dạng "${type}" không nằm trong danh sách hỗ trợ, đổi thành "other"`);
    }
    exercises.push({
      index,
      title: str(raw.title) || `Exercise ${index}`,
      detectedType: (AI_EXERCISE_TYPES as readonly string[]).includes(type) ? type : 'other',
      questionCount: Math.max(0, Math.floor(Number(raw.questionCount) || 0)),
      needsImages: raw.needsImages === true,
      reason: str(raw.reason),
    });
  });

  const exIdxs = new Set<number>();
  for (const ex of exercises) {
    if (exIdxs.has(ex.index)) errors.push(`Trùng chỉ số bài tập: ${ex.index}`);
    exIdxs.add(ex.index);
  }
  if (exercises.length === 0) errors.push('AI không nhận diện được bài tập nào');

  const images: AiImagePlanItem[] = [];
  const slotIds = new Set<string>();
  const labelKeys = new Set<string>();
  const prompts = new Map<string, string>();

  (input.images as unknown[]).forEach((raw, i) => {
    if (!isObj(raw)) { errors.push(`images[${i}] không hợp lệ`); return; }
    const slotId = str(raw.slotId);
    const exerciseIndex = Number(raw.exerciseIndex);
    const label = str(raw.label);
    const subject = str(raw.subject);
    const prompt = str(raw.prompt);
    const aspect = str(raw.aspectRatio) as AiAspectRatio;
    const at = `images[${i}]${slotId ? ` (${slotId})` : ''}`;

    if (!slotId) { errors.push(`${at}: thiếu slotId`); return; }
    if (!/^[A-Za-z0-9_-]{2,60}$/.test(slotId)) errors.push(`${at}: slotId chỉ gồm chữ, số, "_" và "-"`);
    if (slotIds.has(slotId)) errors.push(`${at}: trùng slotId`);
    slotIds.add(slotId);

    if (!Number.isInteger(exerciseIndex) || !exIdxs.has(exerciseIndex)) errors.push(`${at}: exerciseIndex ${raw.exerciseIndex} không khớp bài nào`);
    if (!label) errors.push(`${at}: thiếu label`);
    const related = Array.isArray(raw.relatedQuestionNumbers)
      ? (raw.relatedQuestionNumbers as unknown[]).map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0)
      : [];
    // Nhãn A/B/C có thể lặp lại ở mỗi câu (câu hỏi chọn ảnh): khi đó nhãn chỉ cần duy nhất trong cùng câu
    const lk = `${exerciseIndex}|${label.toLowerCase()}|${related.length === 1 ? related[0] : ''}`;
    if (labelKeys.has(lk)) errors.push(`${at}: trùng nhãn "${label}" trong bài ${exerciseIndex}`);
    labelKeys.add(lk);

    if (!subject) errors.push(`${at}: thiếu subject`);
    if (prompt.length < 15) errors.push(`${at}: prompt quá ngắn`);
    const np = normPrompt(prompt);
    if (prompts.has(np)) errors.push(`${at}: prompt trùng với ${prompts.get(np)}`);
    prompts.set(np, slotId);
    if (/[^\x00-\x7F]/.test(prompt)) warnings.push(`${at}: prompt có ký tự không phải tiếng Anh/ASCII`);
    if (/\b(text|caption|label|letter|word)s?\b.*\b(saying|reading|that says)\b/i.test(prompt)) {
      warnings.push(`${at}: prompt có vẻ yêu cầu chữ trong ảnh (AI hay vẽ sai chữ)`);
    }

    const aspectRatio: AiAspectRatio = (AI_ASPECT_RATIOS as string[]).includes(aspect) ? aspect : '4:3';
    if (aspect && aspectRatio !== aspect) warnings.push(`${at}: aspectRatio "${aspect}" không hỗ trợ, dùng 4:3`);

    images.push({
      slotId, exerciseIndex, label, subject, prompt, aspectRatio,
      needsReference: raw.needsReference === true,
      referenceNote: str(raw.referenceNote),
      relatedQuestionNumbers: related,
      answerKeyLabel: str(raw.answerKeyLabel),
    });
  });

  // Bài đánh dấu cần ảnh nhưng không có ảnh nào, hoặc ngược lại
  for (const ex of exercises) {
    const n = images.filter((im) => im.exerciseIndex === ex.index).length;
    if (ex.needsImages && n === 0) warnings.push(`Bài ${ex.index}: AI đánh dấu cần ảnh nhưng không có ảnh nào trong kế hoạch`);
    if (!ex.needsImages && n > 0) warnings.push(`Bài ${ex.index}: AI nói không cần ảnh nhưng có ${n} ảnh trong kế hoạch`);
  }

  const exerciseCount = Math.floor(Number((input as Record<string, unknown>).exerciseCount) || exercises.length);
  const questionCount = Math.floor(
    Number((input as Record<string, unknown>).questionCount) || exercises.reduce((s, e) => s + e.questionCount, 0),
  );
  if (exerciseCount !== exercises.length) warnings.push(`exerciseCount (${exerciseCount}) khác số bài liệt kê (${exercises.length})`);

  if (errors.length) return { ok: false, errors, warnings };
  return { ok: true, errors, warnings, plan: { exerciseCount: exercises.length, questionCount, exercises, images } };
}
