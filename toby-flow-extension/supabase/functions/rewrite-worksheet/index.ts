// Supabase Edge Function: rewrite-worksheet
// Nhận đoạn văn teacher dán + mô tả định dạng của dạng bài -> Gemini viết lại đúng định dạng -> trả về văn bản + ghi chú.
// Có hạn mức mỗi ngày cho mỗi người dùng (bảng ai_usage, xem migration 003).
//
// Triển khai:
//   1) Chạy supabase/migrations/003_ai_usage.sql trong SQL Editor
//   2) supabase secrets set GEMINI_API_KEY=<khóa Gemini>      (đã có nếu đã triển khai analyze-worksheet)
//      supabase secrets set AI_DAILY_LIMIT=30                 (tuỳ chọn, mặc định 30 lượt/ngày/người)
//   3) supabase functions deploy rewrite-worksheet
// (verify_jwt mặc định BẬT: chỉ người dùng đã đăng nhập Supabase mới gọi được. SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY do Supabase tự cấp.)

import { buildGeminiRequest, checkInput, GEMINI_MODEL, parseResult, type RewriteInput } from './core.ts';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (req: Request) => Promise<Response> | Response): void };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const limitPerDay = () => {
  const n = Number(Deno.env.get('AI_DAILY_LIMIT'));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30;
};

/** Gọi RPC bằng service role (các hàm ai_usage_* chỉ service_role được chạy) */
async function rpc(name: string, args: Record<string, unknown>): Promise<any> {
  const base = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!base || !key) throw new Error('Server thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as any)?.message || `RPC ${name} lỗi HTTP ${res.status}`);
  return data;
}

/** Lấy id người dùng từ token đăng nhập của request */
async function userIdOf(req: Request): Promise<string | null> {
  const base = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const auth = req.headers.get('Authorization');
  if (!base || !key || !auth) return null;
  const res = await fetch(`${base}/auth/v1/user`, { headers: { apikey: key, Authorization: auth } });
  if (!res.ok) return null;
  const u = await res.json().catch(() => null);
  return typeof u?.id === 'string' ? u.id : null;
}

async function callGemini(apiKey: string, input: RewriteInput, attempt = 0): Promise<unknown> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(buildGeminiRequest(input)),
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 2) {
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1) ** 2));
    return callGemini(apiKey, input, attempt + 1);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as any)?.error?.message || `HTTP ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Chỉ hỗ trợ POST' });

  const limit = limitPerDay();
  const uid = await userIdOf(req);
  if (!uid) return json(401, { code: 'NOT_SIGNED_IN', error: 'Chưa đăng nhập Supabase' });

  const body = await req.json().catch(() => null);

  // Chỉ xem số lượt đã dùng hôm nay, không tốn lượt
  if ((body as any)?.peek) {
    try {
      const used = Number(await rpc('ai_usage_peek', { p_user: uid })) || 0;
      return json(200, { ok: true, usage: { used, limit } });
    } catch (e) {
      return json(500, { code: 'USAGE_ERROR', error: (e as Error).message });
    }
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return json(500, { code: 'NO_API_KEY', error: 'Server chưa cấu hình GEMINI_API_KEY' });

  const input = checkInput(body);
  if (!input.ok) return json(input.status, { code: 'BAD_INPUT', error: input.error });

  // Giữ chỗ một lượt trước khi gọi AI; lỗi thì hoàn lại
  let used = 0;
  try {
    const row = (await rpc('ai_usage_bump', { p_user: uid, p_limit: limit }))?.[0];
    used = Number(row?.used) || 0;
    if (!row?.allowed) return json(429, { code: 'DAILY_LIMIT', error: `Đã hết ${limit} lượt AI hôm nay. Lượt được làm mới lúc 0h (giờ Việt Nam).`, usage: { used, limit } });
  } catch (e) {
    return json(500, { code: 'USAGE_ERROR', error: (e as Error).message });
  }

  const refund = async () => { try { await rpc('ai_usage_refund', { p_user: uid }); used = Math.max(0, used - 1); } catch { /* bỏ qua */ } };

  try {
    const resp = await callGemini(apiKey, input.input);
    const result = parseResult(resp, input.input.text);
    return json(200, { ok: true, model: 'gemini-2.5-flash', text: result.text, notes: result.notes, usage: { used, limit } });
  } catch (e) {
    await refund();
    const status = (e as { status?: number }).status;
    if (status === 429) return json(429, { code: 'RATE_LIMITED', error: 'Gemini (gói miễn phí) đang chạm giới hạn, hãy thử lại sau ít phút', usage: { used, limit } });
    return json(502, { code: 'GEMINI_ERROR', error: (e as Error).message, usage: { used, limit } });
  }
});
