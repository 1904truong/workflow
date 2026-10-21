// Giao tiếp web -> extension Flow Bridge qua window.postMessage (cùng giao thức với ImageStudioScreen).
// Web không giữ khóa/token nào: mọi việc cần quyền (Supabase, Gemini, Flow) do extension làm.

export interface BridgeError {
  code: string;
  message: string;
  details?: unknown;
}

export interface BridgeResponse<T = any> {
  payload: T;
  error?: BridgeError;
}

export function askExtension<T = any>(type: string, payload: unknown, timeoutMs = 20000): Promise<BridgeResponse<T>> {
  return new Promise((resolve, reject) => {
    const id = `${type.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(Object.assign(new Error('Extension không phản hồi'), { code: 'EXTENSION_UNAVAILABLE' }));
    }, timeoutMs);
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.id !== id || data.source !== 'extension') return;
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve({ payload: data.payload, error: data.error });
    };
    window.addEventListener('message', onMessage);
    window.postMessage({ id, type, source: 'web', timestamp: Date.now(), payload }, window.location.origin);
  });
}

export interface GenerateResult {
  imageUrl: string;
  storagePath?: string;
  source: 'supabase' | 'flow';
  warning?: string;
}

/** Nhờ extension tạo 1 ảnh trên Google Flow và trả về ảnh (ưu tiên link Supabase). Ném lỗi có `code`. */
export async function generateImageViaExtension(opts: {
  prompt: string;
  referenceImages?: string[];
  aspectRatio?: string;
  timeoutMs?: number;
  /** Nguồn ảnh: mặc định Google Flow; Magnific/Pexels = mở trang tìm ảnh, người dùng tự chọn và tải */
  provider?: 'flow' | 'magnific' | 'pexels';
  /** Từ khóa tìm ảnh cho Magnific/Pexels */
  keyword?: string;
  /** Bộ lọc trang tìm ảnh (orientation, fileType, ai) */
  filters?: Record<string, string>;
}): Promise<GenerateResult> {
  let res: BridgeResponse;
  try {
    res = await askExtension(
      'TRIGGER_GENERATE',
      { prompt: opts.prompt, referenceImages: opts.referenceImages || [], options: { aspectRatio: opts.aspectRatio, provider: opts.provider, keyword: opts.keyword, filters: opts.filters } },
      opts.timeoutMs ?? 300000,
    );
  } catch (e: any) {
    throw Object.assign(new Error(e?.message || 'Extension không phản hồi'), { code: e?.code || 'EXTENSION_UNAVAILABLE' });
  }
  const p = res.payload;
  if (p?.status === 'GENERATED' && p.imageUrl) {
    return { imageUrl: p.imageUrl, storagePath: p.storagePath, source: p.source === 'supabase' ? 'supabase' : 'flow', warning: p.warning };
  }
  const code = res.error?.code || p?.status || 'FAILED';
  throw Object.assign(new Error(res.error?.message || p?.message || 'Không tạo được ảnh'), { code });
}
