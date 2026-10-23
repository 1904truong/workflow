// Smart Paste: nhờ AI (Gemini qua extension -> Supabase Edge Function rewrite-worksheet) viết lại đoạn văn teacher dán
// cho đúng định dạng mà bộ đọc Smart Paste của từng dạng bài hiểu được. Không bao giờ ném lỗi: caller đọc ok / errorMessage.

import { askExtension } from './extensionBridge.ts';

export interface AiUsage {
  used: number;
  limit: number;
}

export interface RewriteOutcome {
  ok: boolean;
  text?: string;
  notes: string[];
  usage?: AiUsage | null;
  errorCode?: string;
  errorMessage?: string;
}

export interface RewriteRequest {
  text: string;
  /** Tên dạng bài, ví dụ "Gap Filling" */
  kind: string;
  /** Mô tả định dạng mà bộ đọc hiểu (đúng câu hướng dẫn hiện trong hộp Smart Paste) */
  hint: string;
  /** Ví dụ đúng định dạng (đúng nội dung gợi ý trong ô dán) */
  example: string;
}

const NO_EXTENSION = 'Không kết nối được Extension. Hãy bật extension Flow Bridge, Reload ở chrome://extensions rồi F5 trang này.';

const FRIENDLY: Record<string, string> = {
  NOT_CONFIGURED: 'Extension chưa cấu hình Supabase (tab Lịch sử → Cấu hình kết nối).',
  NOT_SIGNED_IN: 'Extension chưa đăng nhập Supabase (tab Lịch sử → Đăng nhập).',
  FUNCTION_NOT_DEPLOYED: 'Chưa triển khai Edge Function rewrite-worksheet trên Supabase (xem hướng dẫn trong index.ts của hàm).',
};

const asUsage = (u: unknown): AiUsage | null => {
  const o = u as { used?: unknown; limit?: unknown } | null;
  return o && Number.isFinite(Number(o.used)) && Number.isFinite(Number(o.limit)) ? { used: Number(o.used), limit: Number(o.limit) } : null;
};

/** Xem số lượt AI đã dùng hôm nay (không tốn lượt) */
export async function peekAiUsage(): Promise<AiUsage | null> {
  try {
    const res = await askExtension('REWRITE_WORKSHEET', { peek: true }, 15000);
    return res.error ? null : asUsage(res.payload?.usage);
  } catch {
    return null;
  }
}

export async function rewriteForExercise(req: RewriteRequest): Promise<RewriteOutcome> {
  try {
    const res = await askExtension('REWRITE_WORKSHEET', req, 120000);
    const usage = asUsage(res.payload?.usage);
    if (res.error) {
      const code = res.error.code;
      return { ok: false, notes: [], usage, errorCode: code, errorMessage: FRIENDLY[code] || res.error.message };
    }
    const text = typeof res.payload?.text === 'string' ? res.payload.text : '';
    if (!text.trim()) return { ok: false, notes: [], usage, errorCode: 'EMPTY', errorMessage: 'AI không trả về nội dung.' };
    return { ok: true, text, notes: Array.isArray(res.payload?.notes) ? res.payload.notes : [], usage };
  } catch (e: any) {
    return { ok: false, notes: [], errorCode: e?.code || 'EXTENSION_UNAVAILABLE', errorMessage: NO_EXTENSION };
  }
}

// ───────────── Đọc ảnh đề: AI chọn layout + chép đề ─────────────

export interface ImageLayoutChoice {
  id: string;
  label: string;
  desc: string;
  hint: string;
  example: string;
}

export interface ReadImageOutcome {
  ok: boolean;
  layout?: string;
  confidence?: number | null;
  text?: string;
  notes: string[];
  usage?: AiUsage | null;
  errorCode?: string;
  errorMessage?: string;
}

/** Gửi ảnh đề (data URL JPEG/PNG đã thu nhỏ) cho AI: trả về layout khớp nhất trong `layouts` và đề đã chép đúng định dạng của layout đó */
export async function readWorksheetImage(req: { dataUrl: string; kind: string; layouts: ImageLayoutChoice[]; text?: string }): Promise<ReadImageOutcome> {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(req.dataUrl);
  if (!m) return { ok: false, notes: [], errorCode: 'BAD_IMAGE', errorMessage: 'Không đọc được ảnh này.' };
  try {
    const res = await askExtension('REWRITE_WORKSHEET', {
      image: { mime: m[1].toLowerCase(), data: m[2] },
      layouts: req.layouts,
      kind: req.kind,
      text: req.text || '',
    }, 150000);
    const usage = asUsage(res.payload?.usage);
    if (res.error) {
      const code = res.error.code;
      return { ok: false, notes: [], usage, errorCode: code, errorMessage: FRIENDLY[code] || res.error.message };
    }
    const layout = typeof res.payload?.layout === 'string' ? res.payload.layout : '';
    const text = typeof res.payload?.text === 'string' ? res.payload.text : '';
    if (!layout || !text.trim()) return { ok: false, notes: [], usage, errorCode: 'EMPTY', errorMessage: 'AI không đọc được nội dung từ ảnh. Thử ảnh rõ và cắt gọn hơn.' };
    const conf = Number(res.payload?.confidence);
    return { ok: true, layout, text, confidence: Number.isFinite(conf) ? conf : null, notes: Array.isArray(res.payload?.notes) ? res.payload.notes : [], usage };
  } catch (e: any) {
    return { ok: false, notes: [], errorCode: e?.code || 'EXTENSION_UNAVAILABLE', errorMessage: NO_EXTENSION };
  }
}
