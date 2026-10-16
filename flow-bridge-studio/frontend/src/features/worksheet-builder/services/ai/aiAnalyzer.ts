import { askExtension } from './extensionBridge.ts';
import { validateImagePlan, type AiImagePlan } from './imagePlanSchema.ts';

export interface AiAnalysisOutcome {
  ok: boolean;
  plan?: AiImagePlan;
  warnings: string[];
  /** Mã lỗi khi ok=false: NOT_CONFIGURED, NOT_SIGNED_IN, FUNCTION_NOT_DEPLOYED, RATE_LIMITED, EXTENSION_UNAVAILABLE... */
  errorCode?: string;
  errorMessage?: string;
}

/** Gọi Gemini (qua extension -> Supabase Edge Function). Không bao giờ ném lỗi: caller dùng parser làm fallback khi ok=false. */
export async function analyzeWorksheetWithAI(text: string): Promise<AiAnalysisOutcome> {
  try {
    const res = await askExtension('ANALYZE_WORKSHEET', { text }, 120000);
    if (res.error) return { ok: false, warnings: [], errorCode: res.error.code, errorMessage: res.error.message };
    // Kiểm tra lại ở phía web (không tin dữ liệu đi qua nhiều lớp)
    const v = validateImagePlan(res.payload?.plan);
    if (!v.ok) return { ok: false, warnings: v.warnings, errorCode: 'INVALID_AI_OUTPUT', errorMessage: v.errors.join('; ') };
    return { ok: true, plan: v.plan, warnings: [...(res.payload?.warnings || []), ...v.warnings] };
  } catch (e: any) {
    return {
      ok: false,
      warnings: [],
      errorCode: e?.code || 'EXTENSION_UNAVAILABLE',
      errorMessage: 'Không kết nối được Extension. Hãy bật extension Flow Bridge, Reload ở chrome://extensions rồi F5 trang này.',
    };
  }
}
