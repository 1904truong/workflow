// Logic thuần của Edge Function analyze-worksheet (không dùng API riêng của Deno -> test được bằng Node).
import { AI_EXERCISE_TYPES, validateImagePlan, type ValidationResult } from './schema.ts';

export const GEMINI_MODEL = 'gemini-2.5-flash';
export const MAX_INPUT_CHARS = 30000;

export const SYSTEM_INSTRUCTION = `You are an expert assistant for English-teaching worksheets (Cambridge-style exams and school worksheets).
You receive the full raw text of a worksheet pasted by a teacher. Analyse it and produce an IMAGE PLAN as JSON.

Rules:
1. Identify EVERY exercise in the original order and count its questions. Never merge, drop or reorder exercises/questions.
2. Decide per exercise whether illustrations are needed, based on the CONTENT, not on a fixed rule:
   - "Matching pictures" / "look at the pictures" exercises: one image per lettered picture option (A, B, C...). The picture list in the text defines how many images exist; do NOT invent extra pictures or skip listed ones.
   - Reading passages: only add an illustration if the text clearly benefits from one; otherwise none.
   - Multiple-choice questions whose OPTIONS are pictures (e.g. "What did Sally buy?" with pictures A, B, C): one image per option per question. Labels A/B/C repeat for every question, so make slotIds unique (e.g. "ex5_q1_A") and put that question number in relatedQuestionNumbers (exactly one number). Do NOT generate clock faces, calendar dates or anything that depends on exact digits/text: set needsImages for those only if the teacher wants it, and warn in "reason".
   - Pictures that already exist in the worksheet are shown in the text only as labels (A, B, C...); create one image plan per label, using the surrounding text/answer key to infer the subject.
   - Pure grammar, gap-fill, short-answer, true/false exercises: normally no image.
3. For every image give a UNIQUE slotId (letters, digits, "_" or "-", e.g. "ex2_pic_A"), the exerciseIndex (1-based), the label exactly as in the worksheet (A, B, C...), a short "subject" (the visual subject, e.g. "Coastal Lagoon") and an English "prompt".
4. The prompt describes ONLY the picture's subject and composition (scene, objects, viewpoint). Do not describe art style or colours of the whole worksheet (style is added by the application). Never ask for text, letters, labels, captions or numbers inside the image. Each prompt must be different and specific to its own subject.
5. Preserve answer mapping: if the exercise has an answer key, set answerKeyLabel and relatedQuestionNumbers so the image whose label is X is linked to the question(s) whose correct answer is X. The picture label is what the teacher printed; never reassign labels.
6. needsReference = true only if the worksheet clearly requires a recurring character/object to look the same across images (or the teacher references an existing picture). Explain in referenceNote. Otherwise false and referenceNote "".
7. aspectRatio must be one of "1:1", "4:3", "16:9", "3:4" (use 4:3 for picture-matching options unless the content suggests otherwise).
8. Use detectedType from the allowed list; use "other" when nothing fits. Fill "reason" with one short sentence.
Return JSON only, matching the schema.`;

type GeminiSchema = Record<string, unknown>;
const S = (type: string, extra: GeminiSchema = {}): GeminiSchema => ({ type, ...extra });

export const RESPONSE_SCHEMA: GeminiSchema = S('OBJECT', {
  properties: {
    exerciseCount: S('INTEGER'),
    questionCount: S('INTEGER'),
    exercises: S('ARRAY', {
      items: S('OBJECT', {
        properties: {
          index: S('INTEGER'),
          title: S('STRING'),
          detectedType: S('STRING', { enum: [...AI_EXERCISE_TYPES] }),
          questionCount: S('INTEGER'),
          needsImages: S('BOOLEAN'),
          reason: S('STRING'),
        },
        required: ['index', 'title', 'detectedType', 'questionCount', 'needsImages', 'reason'],
      }),
    }),
    images: S('ARRAY', {
      items: S('OBJECT', {
        properties: {
          slotId: S('STRING'),
          exerciseIndex: S('INTEGER'),
          label: S('STRING'),
          subject: S('STRING'),
          prompt: S('STRING'),
          aspectRatio: S('STRING', { enum: ['1:1', '4:3', '16:9', '3:4'] }),
          needsReference: S('BOOLEAN'),
          referenceNote: S('STRING'),
          relatedQuestionNumbers: S('ARRAY', { items: S('INTEGER') }),
          answerKeyLabel: S('STRING'),
        },
        required: [
          'slotId', 'exerciseIndex', 'label', 'subject', 'prompt', 'aspectRatio',
          'needsReference', 'referenceNote', 'relatedQuestionNumbers', 'answerKeyLabel',
        ],
      }),
    }),
  },
  required: ['exerciseCount', 'questionCount', 'exercises', 'images'],
});

/** Dựng body gửi tới Gemini generateContent */
export function buildGeminiRequest(worksheetText: string) {
  return {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts: [{ text: `WORKSHEET TEXT:\n\n${worksheetText}` }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  };
}

/** Lấy JSON từ phản hồi Gemini (chịu được code fence / chữ thừa) */
export function extractJsonFromGemini(resp: any): unknown {
  const cand = resp?.candidates?.[0];
  if (!cand) {
    const reason = resp?.promptFeedback?.blockReason;
    throw new Error(reason ? `Gemini từ chối nội dung (${reason})` : 'Gemini không trả về kết quả');
  }
  if (cand.finishReason && !['STOP', 'MAX_TOKENS'].includes(cand.finishReason)) {
    throw new Error(`Gemini dừng bất thường (${cand.finishReason})`);
  }
  const text = (cand.content?.parts || []).map((p: any) => p?.text || '').join('').trim();
  if (!text) throw new Error('Gemini trả về nội dung rỗng');
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    const s = cleaned.indexOf('{');
    const e = cleaned.lastIndexOf('}');
    if (s >= 0 && e > s) return JSON.parse(cleaned.slice(s, e + 1));
    throw new Error('Gemini trả về JSON không hợp lệ');
  }
}

export function checkInput(body: unknown): { ok: true; text: string } | { ok: false; status: number; error: string } {
  const text = typeof (body as any)?.text === 'string' ? (body as any).text.trim() : '';
  if (!text) return { ok: false, status: 400, error: 'Thiếu nội dung bài tập (text)' };
  if (text.length > MAX_INPUT_CHARS) return { ok: false, status: 413, error: `Nội dung quá dài (tối đa ${MAX_INPUT_CHARS} ký tự)` };
  return { ok: true, text };
}

export function parseAndValidate(geminiResp: unknown): ValidationResult {
  return validateImagePlan(extractJsonFromGemini(geminiResp));
}
