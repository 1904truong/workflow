import type { Exercise, ImageSlot } from '../../types/index.ts';
import { PRINT_TOKENS } from '../../tokens/printTokens.ts';
import type { AiImagePlan, AiImagePlanItem, AiAspectRatio } from './imagePlanSchema.ts';

export interface Disagreement {
  id: string;
  level: 'warn' | 'info';
  /** Bài tập liên quan (1-based) nếu có */
  exerciseIndex?: number;
  message: string;
}

/** Phần phong cách chung gắn vào MỌI prompt ảnh (giữ cả đề đồng bộ, an toàn khi in). Giáo viên sửa được ở bước duyệt. */
export const DEFAULT_STYLE_SUFFIX =
  'Clean black and white minimalist line art illustration, white background, clear bold outlines, simple educational style for an English worksheet, no text, no letters, no numbers, no captions.';

export function buildFinalPrompt(subjectPrompt: string, style: string = DEFAULT_STYLE_SUFFIX): string {
  const base = subjectPrompt.trim().replace(/[.\s]+$/, '');
  return style.trim() ? `${base}. ${style.trim()}` : `${base}.`;
}

/** So sánh kế hoạch của AI với kết quả parser hiện có. Không bắt buộc phải khớp: chỉ đánh dấu để giáo viên xem. */
export function compareWithParser(plan: AiImagePlan, parserExercises: Exercise[]): Disagreement[] {
  const out: Disagreement[] = [];

  if (plan.exerciseCount !== parserExercises.length) {
    out.push({
      id: 'exercise_count',
      level: 'warn',
      message: `Số bài tập khác nhau: AI nhận ${plan.exerciseCount}, parser nhận ${parserExercises.length}`,
    });
  }

  plan.exercises.forEach((aiEx) => {
    const pe = parserExercises[aiEx.index - 1];
    if (!pe) {
      out.push({ id: `missing_${aiEx.index}`, level: 'warn', exerciseIndex: aiEx.index, message: `Bài ${aiEx.index} ("${aiEx.title}") chỉ AI nhận ra, parser không có` });
      return;
    }
    if (aiEx.detectedType !== 'other' && aiEx.detectedType !== pe.type) {
      out.push({
        id: `type_${aiEx.index}`,
        level: 'warn',
        exerciseIndex: aiEx.index,
        message: `Bài ${aiEx.index}: dạng bài khác nhau — AI: ${aiEx.detectedType}, parser: ${pe.type}`,
      });
    }
    if (aiEx.questionCount !== pe.questions.length) {
      out.push({
        id: `questions_${aiEx.index}`,
        level: 'warn',
        exerciseIndex: aiEx.index,
        message: `Bài ${aiEx.index}: số câu hỏi khác nhau — AI: ${aiEx.questionCount}, parser: ${pe.questions.length}`,
      });
    }

    const aiLabels = plan.images.filter((im) => im.exerciseIndex === aiEx.index).map((im) => im.label.toUpperCase());
    const parserLabels = pe.imageSlots.map((s) => (s.label || '').toUpperCase());
    const onlyAi = aiLabels.filter((l) => !parserLabels.includes(l));
    const onlyParser = parserLabels.filter((l) => !aiLabels.includes(l));
    if (aiLabels.length !== parserLabels.length || onlyAi.length || onlyParser.length) {
      out.push({
        id: `slots_${aiEx.index}`,
        level: 'warn',
        exerciseIndex: aiEx.index,
        message:
          `Bài ${aiEx.index}: số ô ảnh khác nhau — AI: ${aiLabels.length} (${aiLabels.join(', ') || '—'}), ` +
          `parser: ${parserLabels.length} (${parserLabels.join(', ') || '—'})`,
      });
    }
  });

  parserExercises.forEach((pe, i) => {
    if (!plan.exercises.some((e) => e.index === i + 1)) {
      out.push({ id: `parser_only_${i + 1}`, level: 'warn', exerciseIndex: i + 1, message: `Bài ${i + 1} ("${pe.title}") chỉ parser nhận ra, AI không có` });
    }
  });
  return out;
}

/** Kế hoạch dự phòng khi Gemini không dùng được: chỉ dựa vào các ô ảnh parser đã tìm thấy. */
export function planFromParser(exercises: Exercise[]): AiImagePlan {
  const images: AiImagePlanItem[] = [];
  exercises.forEach((ex, i) => {
    ex.imageSlots.forEach((slot, k) => {
      const label = slot.label || String.fromCharCode(65 + k);
      const generic = !slot.caption || /^picture\s+[a-z0-9]+$/i.test(slot.caption.trim());
      const subject = generic ? `Illustration ${label} for "${ex.title}"` : (slot.caption as string);
      images.push({
        slotId: `ex${i + 1}_pic_${label}`,
        exerciseIndex: i + 1,
        label,
        subject,
        prompt: `A clear illustration of: ${subject}`,
        aspectRatio: (slot.aspectRatio as AiAspectRatio) || '4:3',
        needsReference: false,
        referenceNote: '',
        relatedQuestionNumbers: [],
        answerKeyLabel: '',
      });
    });
  });
  return {
    exerciseCount: exercises.length,
    questionCount: exercises.reduce((s, e) => s + e.questions.length, 0),
    exercises: exercises.map((ex, i) => ({
      index: i + 1,
      title: ex.title,
      detectedType: ex.type === 'grammar_vocab_cloze' ? 'grammar_vocab_multiple_choice' : ex.type,
      questionCount: ex.questions.length,
      needsImages: ex.imageSlots.length > 0,
      reason: 'Suy ra từ parser (không dùng AI)',
    })),
    images,
  };
}

/**
 * Áp kế hoạch ảnh đã duyệt lên các bài tập parser đã dựng: khớp ô theo (bài, nhãn), tạo ô còn thiếu.
 * Mỗi ô nhận slotId DUY NHẤT toàn đề: `${namespace}_${slotId của AI}`.
 * Trả về bài tập mới + bảng "slotId của AI -> ô thật" để tạo job.
 */
export function applyPlanToExercises(
  plan: AiImagePlan,
  exercises: Exercise[],
  namespace: string,
): { exercises: Exercise[]; slotMap: Record<string, { exerciseId: string; slotId: string }> } {
  const slotMap: Record<string, { exerciseId: string; slotId: string }> = {};
  const next = exercises.map((ex) => ({ ...ex, imageSlots: ex.imageSlots.map((s) => ({ ...s })) }));

  for (const item of plan.images) {
    const ex = next[item.exerciseIndex - 1];
    if (!ex) continue;
    const finalId = `${namespace}_${item.slotId}`;
    const labelUp = item.label.toUpperCase();
    const preset = PRINT_TOKENS.imageSlots.matching;

    let slot = ex.imageSlots.find((s) => (s.label || '').toUpperCase() === labelUp);
    if (!slot) {
      slot = {
        slotId: finalId,
        exerciseId: ex.id,
        label: item.label,
        widthMm: preset.widthMm,
        heightMm: preset.heightMm,
        aspectRatio: item.aspectRatio,
        status: 'empty',
      } as ImageSlot;
      ex.imageSlots.push(slot);
    }
    slot.slotId = finalId;
    slot.exerciseId = ex.id;
    slot.caption = item.subject;
    slot.aspectRatio = item.aspectRatio;
    slot.aiPrompt = item.prompt;
    slotMap[item.slotId] = { exerciseId: ex.id, slotId: finalId };
  }

  next.forEach((ex) => {
    if (ex.imageSlots.length > 1 && ex.layoutType === 'template_a') ex.layoutType = 'template_b';
    if (ex.imageSlots.length === 1 && ex.layoutType === 'template_a') ex.layoutType = 'template_c';
  });
  return { exercises: next, slotMap };
}
