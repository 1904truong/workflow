// Tạo ảnh bằng extension Flow Bridge: dùng chung cho mọi trình soạn (kiểm tra extension, gọi tạo ảnh, báo lỗi cùng một cách).

import { useState } from 'react';
import { askExtension, generateImageViaExtension } from './extensionBridge';
import { buildFinalPrompt } from './imagePlanCompare';
import { friendlyExtensionError } from '../matching/autoMatching';
import { getImageSource, keywordFromPrompt, PROVIDER_SHORT, setImageSource } from './imageSource';
import { analyzeWorksheetWithAI } from './aiAnalyzer';

export interface ExtensionProbe {
  /** Có extension trả lời */
  present: boolean;
  /** Extension sẵn sàng tạo ảnh */
  ready: boolean;
  /** Thông báo cho người dùng khi chưa sẵn sàng */
  note: string;
}

export const probeExtension = async (): Promise<ExtensionProbe> => {
  try {
    const res = await askExtension<{ status?: string; message?: string }>('GET_FLOW_STATUS', {}, 5000);
    const st = res.payload?.status;
    if (st === 'CONNECTED' || st === 'FLOW_TAB_NOT_FOUND' || st === 'PROJECT_NOT_OPEN') return { present: true, ready: true, note: '' };
    return { present: true, ready: false, note: friendlyExtensionError(res.payload?.message || res.error?.message || 'Extension chưa sẵn sàng tạo ảnh.') };
  } catch {
    return { present: false, ready: false, note: 'Không kết nối được extension Flow Bridge. Hãy bật extension rồi tải lại trang (F5).' };
  }
};

export interface UseAiImageOptions {
  /** Prompt dự phòng khi người dùng chưa nhập prompt riêng */
  getPrompt: () => string;
  /** Phong cách ghép vào prompt (ví dụ PHOTO_STYLE, MAP_STYLE) */
  style: string;
  aspectRatio: string;
  /** Lưu lại prompt đã dùng (kể cả khi extension chưa sẵn sàng để người dùng sửa và thử lại) */
  onPrompt: (prompt: string) => void;
  /** Ảnh tạo xong */
  onImage: (url: string, prompt: string) => void;
}

/**
 * Nhờ AI (Gemini qua extension) đọc nội dung bài và đưa ra từ khóa ngắn để tìm ảnh stock.
 * Dùng chủ thể "subject" mà AI rút ra cho ảnh; AI không dùng được (chưa cấu hình/đăng nhập, quá lâu) thì rút từ khóa tại chỗ.
 */
export const suggestStockKeyword = async (prompt: string): Promise<{ keyword: string; byAi: boolean }> => {
  const local = keywordFromPrompt(prompt);
  try {
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 30000));
    const out = await Promise.race([analyzeWorksheetWithAI(`Exercise 1: Picture for a worksheet
Image needed: ${prompt}`), timeout]);
    const subject = out && out.ok && out.plan ? out.plan.images[0]?.subject?.trim() : '';
    if (subject) {
      const words = subject.replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, 5).join(' ');
      if (words) return { keyword: words.toLowerCase(), byAi: true };
    }
  } catch { /* dùng từ khóa tại chỗ */ }
  return { keyword: local, byAi: false };
};

export const useAiImage = (opts: UseAiImageOptions) => {
  const [gen, setGen] = useState<{ busy: boolean; msg: string }>({ busy: false, msg: '' });

  const generate = async (prompt?: string): Promise<boolean> => {
    const p = (prompt || opts.getPrompt()).trim();
    // Tự động (Smart AI) truyền sẵn prompt thì luôn tạo bằng Flow; chỉ nút bấm tay mới theo nguồn đã chọn
    const provider = prompt ? 'flow' : getImageSource().provider;

    // Magnific / Pexels: extension mở trang tìm ảnh, người dùng tự chọn và bấm Tải xuống, ảnh tự trả về đây
    if (provider !== 'flow') {
      const name = PROVIDER_SHORT[provider];
      let keyword = getImageSource().keyword.trim();
      if (!keyword) {
        setGen({ busy: true, msg: 'AI đang phân tích nội dung để rút từ khóa tìm ảnh…' });
        const sug = await suggestStockKeyword(p);
        keyword = sug.keyword;
        if (!keyword) { setGen({ busy: false, msg: 'Chưa có từ khóa để tìm ảnh. Hãy nhập từ khóa.' }); return false; }
        setImageSource({ keyword });
      }
      setGen({ busy: true, msg: `Đang mở ${name} với từ khóa "${keyword}"…` });
      const probe = await probeExtension();
      if (!probe.present) { setGen({ busy: false, msg: probe.note }); return false; }
      setGen({ busy: true, msg: `Đã mở ${name}: hãy chọn ảnh rồi bấm Tải xuống, ảnh sẽ tự vào bài.` });
      try {
        const f = getImageSource().filters;
        const res = await generateImageViaExtension({
          prompt: p, provider, keyword, aspectRatio: opts.aspectRatio, timeoutMs: 21 * 60 * 1000,
          filters: { orientation: f.orientation, fileType: f.fileType, ...(f.ai ? { ai: f.ai } : {}) },
        });
        opts.onImage(res.imageUrl, p);
        setGen({ busy: false, msg: `Đã lấy ảnh từ ${name} (từ khóa "${keyword}") và gắn vào bài.` });
        setImageSource({ keyword: '' });
        return true;
      } catch (e) {
        setGen({ busy: false, msg: friendlyExtensionError(e instanceof Error ? e.message : 'Không lấy được ảnh') });
        setImageSource({ keyword: '' });
        return false;
      }
    }

    setGen({ busy: true, msg: 'Đang tạo ảnh…' });
    const probe = await probeExtension();
    if (!probe.ready) {
      setGen({ busy: false, msg: probe.note });
      opts.onPrompt(p);
      return false;
    }
    try {
      const res = await generateImageViaExtension({ prompt: buildFinalPrompt(p, opts.style), aspectRatio: getImageSource().flowRatio || opts.aspectRatio });
      opts.onImage(res.imageUrl, p);
      setGen({ busy: false, msg: 'Đã tạo và gắn ảnh vào bài.' });
      return true;
    } catch (e) {
      setGen({ busy: false, msg: friendlyExtensionError(e instanceof Error ? e.message : 'Không tạo được ảnh') });
      return false;
    }
  };

  return { gen, generate };
};
