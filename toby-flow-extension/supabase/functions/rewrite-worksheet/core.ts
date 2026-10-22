// Logic thuần của Edge Function rewrite-worksheet (không dùng API riêng của Deno -> test được bằng Node).
// Việc: nhận đoạn văn teacher dán (lộn xộn) + MÔ TẢ ĐỊNH DẠNG và VÍ DỤ của đúng dạng bài, viết lại đúng định dạng đó để bộ đọc Smart Paste của app đọc được.

export const GEMINI_MODEL = 'gemini-2.5-flash';
export const MAX_INPUT_CHARS = 30000;
export const MAX_SPEC_CHARS = 4000;

export const SYSTEM_INSTRUCTION = `You are a text formatter for an English-worksheet editor. A teacher pasted raw text (often copied from a PDF, Word or a website, so line breaks, numbering and blanks may be messy).
Your ONLY job is to rewrite the text into the exact input format that the editor's "Smart Paste" parser understands. The format description and a correct example for this exercise type are given to you.

Strict rules:
1. Keep ALL of the teacher's content: every word, sentence, question, option, blank and the original order. Do NOT add, invent, translate, answer, shorten, summarise or "improve" any content. Do not add answer keys or correct answers.
2. Only fix structure: line breaks, numbering, labels (A/B/C, a/b/c), blank markers (use the blank style shown in the example, e.g. (a) ______), word-bank line, headings, bullet characters. Remove obvious noise that is not exercise content (page numbers, headers/footers, OCR junk, duplicated spaces).
3. Follow the FORMAT DESCRIPTION and imitate the structure of the EXAMPLE exactly (it shows layout only; never copy the example's wording into the output).
4. If something required by the format is missing in the pasted text (for example no title), do not invent it; leave it out and mention it in "notes".
5. If a part of the text is ambiguous, keep it as it was and mention it in "notes".
6. "text" must be the rewritten text only, ready to paste, with no explanation, no markdown fences. "notes" is a short list (max 6 items, Vietnamese) of what you changed or could not decide.
Return JSON only.`;

export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    text: { type: 'STRING' },
    notes: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['text', 'notes'],
};

export interface RewriteInput {
  text: string;
  kind: string;
  hint: string;
  example: string;
}

/** Dựng body gửi tới Gemini generateContent */
export function buildGeminiRequest(input: RewriteInput) {
  const prompt = [
    `EXERCISE TYPE: ${input.kind || 'worksheet exercise'}`,
    `FORMAT DESCRIPTION (what the parser expects):\n${input.hint || '(none given, keep a clean, readable structure)'}`,
    `EXAMPLE OF CORRECT FORMAT (layout only):\n${input.example || '(none)'}`,
    `PASTED TEXT TO REWRITE:\n${input.text}`,
  ].join('\n\n---\n\n');
  return {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
  };
}

export function checkInput(body: unknown): { ok: true; input: RewriteInput } | { ok: false; status: number; error: string } {
  const b = (body || {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const text = str(b.text);
  if (!text) return { ok: false, status: 400, error: 'Thiếu đoạn văn cần viết lại (text)' };
  if (text.length > MAX_INPUT_CHARS) return { ok: false, status: 413, error: `Đoạn văn quá dài (tối đa ${MAX_INPUT_CHARS} ký tự)` };
  const hint = str(b.hint).slice(0, MAX_SPEC_CHARS);
  const example = str(b.example).slice(0, MAX_SPEC_CHARS);
  const kind = str(b.kind).slice(0, 120);
  return { ok: true, input: { text, kind, hint, example } };
}

function extractJson(resp: any): unknown {
  const cand = resp?.candidates?.[0];
  if (!cand) {
    const reason = resp?.promptFeedback?.blockReason;
    throw new Error(reason ? `Gemini từ chối nội dung (${reason})` : 'Gemini không trả về kết quả');
  }
  if (cand.finishReason && !['STOP', 'MAX_TOKENS'].includes(cand.finishReason)) throw new Error(`Gemini dừng bất thường (${cand.finishReason})`);
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

/** Đọc và kiểm tra kết quả; cảnh báo khi AI cắt mất nhiều nội dung */
export function parseResult(geminiResp: unknown, original: string): { text: string; notes: string[] } {
  const raw = extractJson(geminiResp) as { text?: unknown; notes?: unknown };
  const text = typeof raw?.text === 'string' ? raw.text.replace(/\r\n/g, '\n').trim() : '';
  if (!text) throw new Error('AI trả về văn bản rỗng');
  const notes = Array.isArray(raw?.notes) ? raw.notes.filter((n): n is string => typeof n === 'string' && !!n.trim()).slice(0, 6) : [];
  const words = (s: string) => (s.match(/[\p{L}\p{N}']+/gu) || []).length;
  const before = words(original);
  const after = words(text);
  if (before >= 20 && after < before * 0.6) notes.unshift(`Cảnh báo: bản viết lại ngắn hơn bản gốc nhiều (${after}/${before} từ). Hãy đối chiếu kỹ trước khi áp dụng.`);
  return { text, notes };
}
