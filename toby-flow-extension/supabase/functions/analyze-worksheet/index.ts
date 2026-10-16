// Supabase Edge Function: analyze-worksheet
// Nhận văn bản bài tập -> gọi Gemini (khóa nằm trong secrets của server) -> trả về kế hoạch ảnh đã kiểm tra.
//
// Triển khai:
//   supabase secrets set GEMINI_API_KEY=<khóa Gemini>
//   supabase functions deploy analyze-worksheet
// (verify_jwt mặc định BẬT: chỉ người dùng đã đăng nhập Supabase mới gọi được.)

import { buildGeminiRequest, checkInput, GEMINI_MODEL, parseAndValidate } from './core.ts';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (req: Request) => Promise<Response> | Response): void };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function callGemini(apiKey: string, text: string, attempt = 0): Promise<unknown> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    // Khóa gửi qua header, không nằm trong URL (tránh lọt vào log)
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(buildGeminiRequest(text)),
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 2) {
    // Free tier hay chạm giới hạn: chờ rồi thử lại tối đa 2 lần
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1) ** 2));
    return callGemini(apiKey, text, attempt + 1);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as any)?.error?.message || `HTTP ${res.status}`;
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Chỉ hỗ trợ POST' });

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return json(500, { code: 'NO_API_KEY', error: 'Server chưa cấu hình GEMINI_API_KEY' });

  const input = checkInput(await req.json().catch(() => null));
  if (!input.ok) return json(input.status, { code: 'BAD_INPUT', error: input.error });

  try {
    let lastErrors: string[] = [];
    // Nếu AI trả JSON sai schema thì thử lại 1 lần
    for (let round = 0; round < 2; round++) {
      const resp = await callGemini(apiKey, input.text);
      try {
        const result = parseAndValidate(resp);
        if (result.ok) return json(200, { ok: true, model: 'gemini-2.5-flash', plan: result.plan, warnings: result.warnings });
        lastErrors = result.errors;
      } catch (e) {
        lastErrors = [(e as Error).message];
      }
    }
    return json(422, { code: 'INVALID_AI_OUTPUT', error: 'AI trả về kế hoạch không hợp lệ', details: lastErrors });
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 429) return json(429, { code: 'RATE_LIMITED', error: 'Gemini (gói miễn phí) đang chạm giới hạn, hãy thử lại sau ít phút' });
    return json(502, { code: 'GEMINI_ERROR', error: (e as Error).message });
  }
});
