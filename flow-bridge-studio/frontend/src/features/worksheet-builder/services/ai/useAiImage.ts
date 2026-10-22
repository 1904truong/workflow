// Tạo ảnh bằng extension Flow Bridge: dùng chung cho mọi trình soạn (kiểm tra extension, gọi tạo ảnh, báo lỗi cùng một cách).

import { useState } from 'react';
import { askExtension, generateImageViaExtension } from './extensionBridge';
import { buildFinalPrompt } from './imagePlanCompare';
import { friendlyExtensionError } from '../matching/autoMatching';
import { getImageSource, keywordFromPrompt, PROVIDER_SHORT, setImageSource } from './imageSource';
import { analyzeWorksheetWithAI } from './aiAnalyzer';
import { presetText } from './stylePresets';

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
    return { present: true, ready: false, note: friendlyExtensionError(res.payload?.message || res.error?.message || 'The extension is not ready to generate images.') };
  } catch {
    return { present: false, ready: false, note: 'Cannot reach the Flow Bridge extension. Enable it, then reload this page (F5).' };
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
  /** Ảnh tham chiếu riêng cho lần tạo này (data URL); có thì dùng thay cho ảnh tham chiếu trong cấu hình chung */
  refs?: string[];
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

export type GenStatus = { busy: boolean; msg: string };

/**
 * Tạo một ảnh theo nguồn đang chọn (Flow / ChatGPT / Magnific / Pexels). Dùng cho nút từng bài (useAiImage) và cho Generate all.
 * respectSource: true thì luôn theo nguồn đã chọn dù có truyền sẵn prompt (Generate all); mặc định Smart AI truyền prompt thì dùng Flow.
 */
export const runAiImage = async (opts: UseAiImageOptions, setGen: (s: GenStatus) => void, prompt?: string, respectSource = false): Promise<boolean> => {
    const p = (prompt || opts.getPrompt()).trim();
    // Tự động (Smart AI) truyền sẵn prompt thì luôn tạo bằng Flow; chỉ nút bấm tay mới theo nguồn đã chọn
    const provider = prompt && !respectSource ? 'flow' : getImageSource().provider;

    // ChatGPT: tạo ảnh AI qua extension
    if (provider === 'chatgpt') {
      setGen({ busy: true, msg: 'Generating image with ChatGPT…' });
      const probe = await probeExtension();
      if (!probe.ready) {
        setGen({ busy: false, msg: probe.note });
        opts.onPrompt(p);
        return false;
      }
      try {
        const res = await generateImageViaExtension({
          prompt: buildFinalPrompt([getImageSource().chatgptMode === 'edit' ? `Edit the attached reference image(s): ${p}` : p, getImageSource().chatgptStyle, presetText(getImageSource().chatgptPreset) ? `\n\n${presetText(getImageSource().chatgptPreset)}\n` : '', getImageSource().chatgptStyleRef ? 'The LAST attached image is a STYLE reference only: copy its art style (colors, line work, rendering), not its content' : '', ({ transparent: 'transparent background', white: 'plain white background', black: 'plain black background' } as Record<string, string>)[getImageSource().chatgptBg] || ''].filter(Boolean).join(', '), opts.style),
          aspectRatio: getImageSource().flowRatio || opts.aspectRatio,
          referenceImages: [...(opts.refs?.length ? opts.refs : getImageSource().chatgptRefs).slice(0, getImageSource().chatgptStyleRef ? 2 : 3), ...(getImageSource().chatgptStyleRef ? [getImageSource().chatgptStyleRef] : [])],
          provider: 'chatgpt',
          // ChatGPT tạo tối đa ~4 phút + tải/upload ảnh: chờ lâu hơn mặc định 5 phút để không bỏ cuộc khi extension vẫn đang làm
          timeoutMs: 10 * 60 * 1000,
          chatgptEffort: getImageSource().chatgptEffort || 1,
          ui: { presetId: getImageSource().chatgptPreset || '', background: getImageSource().chatgptBg || '' },
        });
        opts.onImage(res.imageUrl, p);
        setGen({ busy: false, msg: 'Image generated with ChatGPT and added to the exercise.' });
        return true;
      } catch (e) {
        setGen({ busy: false, msg: friendlyExtensionError(e instanceof Error ? e.message : 'Could not generate the image with ChatGPT') });
        return false;
      }
    }

    // Magnific / Pexels: extension mở trang tìm ảnh, người dùng tự chọn và bấm Tải xuống, ảnh tự trả về đây
    if (provider === 'magnific' || provider === 'pexels') {
      const name = PROVIDER_SHORT[provider];
      let keyword = getImageSource().keyword.trim();
      if (!keyword) {
        setGen({ busy: true, msg: 'AI is analyzing the exercise to pick search keywords…' });
        const sug = await suggestStockKeyword(p);
        keyword = sug.keyword;
        if (!keyword) { setGen({ busy: false, msg: 'No search keywords yet. Please enter keywords.' }); return false; }
        setImageSource({ keyword });
      }
      setGen({ busy: true, msg: `Opening ${name} with keywords "${keyword}"…` });
      const probe = await probeExtension();
      if (!probe.present) { setGen({ busy: false, msg: probe.note }); return false; }
      setGen({ busy: true, msg: `${name} is open: pick an image and click Download — it goes into the exercise automatically.` });
      try {
        const f = getImageSource().filters;
        const res = await generateImageViaExtension({
          prompt: p, provider, keyword, aspectRatio: getImageSource().stockRatio || opts.aspectRatio, timeoutMs: 21 * 60 * 1000,
          filters: (String(provider) === 'pexels' ? { _inKeyword: '1' } : { ...f }) as Record<string, string>,
        });
        opts.onImage(res.imageUrl, p);
        setGen({ busy: false, msg: `Image from ${name} (keywords "${keyword}") added to the exercise.` });
        setImageSource({ keyword: '' });
        return true;
      } catch (e) {
        setGen({ busy: false, msg: friendlyExtensionError(e instanceof Error ? e.message : 'Could not get the image') });
        setImageSource({ keyword: '' });
        return false;
      }
    }

    setGen({ busy: true, msg: 'Generating image…' });
    const probe = await probeExtension();
    if (!probe.ready) {
      setGen({ busy: false, msg: probe.note });
      opts.onPrompt(p);
      return false;
    }
    try {
      const src = getImageSource();
      const res = await generateImageViaExtension({ prompt: buildFinalPrompt([p, presetText(src.chatgptPreset) ? `\n\n${presetText(src.chatgptPreset)}\n` : ''].filter(Boolean).join(', '), opts.style), aspectRatio: src.flowRatio || opts.aspectRatio, provider: 'flow', ui: { presetId: src.chatgptPreset || '' }, referenceImages: (opts.refs?.length ? opts.refs : src.chatgptRefs).slice(0, 3), flowModel: src.flowModel, flowCount: src.flowCount || 1 });
      opts.onImage(res.imageUrl, p);
      setGen({ busy: false, msg: 'Image generated and added to the exercise.' });
      return true;
    } catch (e) {
      setGen({ busy: false, msg: friendlyExtensionError(e instanceof Error ? e.message : 'Could not generate the image') });
      return false;
    }
};

export const useAiImage = (opts: UseAiImageOptions) => {
  const [gen, setGen] = useState<GenStatus>({ busy: false, msg: '' });
  const generate = (prompt?: string): Promise<boolean> => runAiImage(opts, setGen, prompt);
  return { gen, generate };
};
