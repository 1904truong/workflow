// Đọc ảnh đề: nhận dạng layout phù hợp nhất + chép đề thành văn bản đúng định dạng Smart Paste của layout đó.
// Logic thuần (không dùng API riêng của Deno) nên test được bằng Node. Dùng chung hạn mức lượt AI với rewrite-worksheet.

import { extractJson, MAX_INPUT_CHARS, MAX_SPEC_CHARS } from './core.ts';

export const MAX_IMAGE_BASE64_CHARS = 6_000_000; // ~4.5 MB ảnh gốc
export const MAX_LAYOUTS = 20;

export interface VisionLayout {
  id: string;
  label: string;
  desc: string;
  hint: string;
  example: string;
}

export interface VisionInput {
  kind: string;
  mime: string;
  data: string;
  layouts: VisionLayout[];
  /** Văn bản teacher đã dán thêm (nếu có), dùng để đối chiếu chữ khó đọc trong ảnh */
  text: string;
}

export const VISION_SYSTEM_INSTRUCTION = `You are an assistant for an English-worksheet editor. A teacher uploads a PHOTO or SCREENSHOT of one exercise from a textbook page.
You must (1) choose which one of the editor's LAYOUTS best matches how this exercise is laid out on the page, and (2) transcribe the exercise from the image into the exact text format that the chosen layout's "Smart Paste" parser understands.

Strict rules:
1. Choose "layout" ONLY from the ids given in the LAYOUTS list. Judge by the visual structure (columns, boxes, blanks, word bank, table, dots, numbering, hints in brackets), not by guessing the topic. Each layout has a description plus a format example.
2. Transcribe ALL the visible exercise content faithfully: the title, every item and every word, in reading order. Do NOT translate, correct, answer, shorten or invent anything. Never fill in answers: keep blanks as blanks, written in the blank style shown in the layout's example (for instance ______).
3. Imitate the structure of the chosen layout's EXAMPLE exactly (it shows format only; never copy its wording). Use tab characters between columns when the example does.
4. Ignore page furniture that is not exercise content (page numbers, logos, margins, neighbouring exercises). If the image contains pictures that cannot be written as text, leave them out and mention it in "notes".
5. If you are unsure between layouts, pick the closest one and say why in "notes". "confidence" is a number from 0 to 1.
6. "text" is the transcription only, ready to paste, with no explanation and no markdown fences. "notes" is a short list (max 6 items, Vietnamese) of what you decided or could not read.
Return JSON only.`;

export const visionResponseSchema = (layoutIds: string[]) => ({
  type: 'OBJECT',
  properties: {
    layout: { type: 'STRING', enum: layoutIds },
    confidence: { type: 'NUMBER' },
    text: { type: 'STRING' },
    notes: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['layout', 'text', 'notes'],
});

export function buildVisionRequest(input: VisionInput) {
  const layoutsText = input.layouts
    .map((l) => `- id: ${l.id}\n  name: ${l.label}\n  looks like: ${l.desc}\n  parser format: ${l.hint}\n  format example:\n${l.example.split('\n').map((x) => `    ${x}`).join('\n')}`)
    .join('\n\n');
  const prompt = [
    `EXERCISE TYPE OF THE EDITOR: ${input.kind || 'worksheet exercise'}`,
    `LAYOUTS TO CHOOSE FROM:\n${layoutsText}`,
    input.text ? `TEXT THE TEACHER ALSO PASTED (use only to double-check hard-to-read words):\n${input.text}` : '',
    'Now look at the image and answer.',
  ].filter(Boolean).join('\n\n---\n\n');
  return {
    systemInstruction: { parts: [{ text: VISION_SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: input.mime, data: input.data } }] }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json', responseSchema: visionResponseSchema(input.layouts.map((l) => l.id)) },
  };
}

export function checkVisionInput(body: unknown): { ok: true; input: VisionInput } | { ok: false; status: number; error: string } {
  const b = (body || {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const img = (b.image || {}) as Record<string, unknown>;
  const mime = str(img.mime, 40);
  const data = typeof img.data === 'string' ? img.data.replace(/^data:[^,]*,/, '').replace(/\s+/g, '') : '';
  if (!/^image\/(jpeg|png|webp)$/.test(mime)) return { ok: false, status: 400, error: 'Ảnh phải là JPEG, PNG hoặc WebP' };
  if (!data) return { ok: false, status: 400, error: 'Thiếu dữ liệu ảnh' };
  if (data.length > MAX_IMAGE_BASE64_CHARS) return { ok: false, status: 413, error: 'Ảnh quá lớn, hãy cắt gọn hoặc giảm kích thước' };
  const rawLayouts = Array.isArray(b.layouts) ? b.layouts.slice(0, MAX_LAYOUTS) : [];
  const layouts: VisionLayout[] = rawLayouts
    .map((l) => {
      const o = (l || {}) as Record<string, unknown>;
      return { id: str(o.id, 60), label: str(o.label, 120), desc: str(o.desc, 600), hint: str(o.hint, MAX_SPEC_CHARS), example: str(o.example, MAX_SPEC_CHARS) };
    })
    .filter((l) => l.id);
  if (layouts.length === 0) return { ok: false, status: 400, error: 'Thiếu danh sách layout để chọn (layouts)' };
  return { ok: true, input: { kind: str(b.kind, 120), mime, data, layouts, text: str(b.text, MAX_INPUT_CHARS) } };
}

export function parseVisionResult(geminiResp: unknown, layoutIds: string[]): { layout: string; confidence: number | null; text: string; notes: string[] } {
  const raw = extractJson(geminiResp) as { layout?: unknown; confidence?: unknown; text?: unknown; notes?: unknown };
  const layout = typeof raw?.layout === 'string' ? raw.layout : '';
  if (!layoutIds.includes(layout)) throw new Error('AI chọn layout không hợp lệ');
  const text = typeof raw?.text === 'string' ? raw.text.replace(/\r\n/g, '\n').trim() : '';
  if (!text) throw new Error('AI không đọc được chữ nào trong ảnh');
  const c = Number(raw?.confidence);
  const notes = Array.isArray(raw?.notes) ? raw.notes.filter((n): n is string => typeof n === 'string' && !!n.trim()).slice(0, 6) : [];
  return { layout, confidence: Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : null, text, notes };
}
