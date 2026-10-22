// "Generate all" ở AI Image Studio: quét các bài trong folder, tìm bài còn thiếu ảnh, dựng prompt (nhờ AI phân tích nếu được)
// và gắn ảnh vào đúng trường của từng loại bài. Mỗi loại bài lưu ảnh ở một chỗ riêng nên mỗi loại có một adapter.

import type { Exercise } from '../../types';
import { buildTfImagePrompt } from '../listening-true-false/listeningTrueFalseCore';
import { buildTfngImagePrompt } from '../tfng/tfngCore';
import { buildTableImagePrompt, MAP_STYLE } from '../listening-table/listeningTableCore';
import { splitParagraphs } from '../reading-mcq/readingMcqCore';
import { PHOTO_STYLE } from '../matching/autoMatching';
import { analyzeWorksheetWithAI } from './aiAnalyzer';
import { probeExtension } from './useAiImage';

export interface BatchAdapter {
  kind: string;
  style: string;
  aspectRatio: string;
  /** Bài này có chỗ đặt ảnh, đang bật hiển thị ảnh và chưa có ảnh */
  needsImage: (ex: Exercise) => boolean;
  /** Prompt dựng từ nội dung bài (giống hàm mà trình soạn dùng khi ô prompt trống) */
  basePrompt: (ex: Exercise) => string;
  apply: (ex: Exercise, url: string, prompt: string) => Exercise;
  /** Bài có nhiều ô ảnh (Matching Pictures): mỗi ô thiếu ảnh là một mục riêng, gắn đúng ô theo key */
  targets?: (ex: Exercise) => Array<{ key: string; label: string; prompt: string }>;
  applyTarget?: (ex: Exercise, key: string, url: string, prompt: string) => Exercise;
}

const clean = (t: string, n: number) => t.replace(/\(\w+\)\s*_{2,}/g, '').replace(/[*+]{1,2}/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const scene = (word: string, title: string | undefined, first: string) =>
  `${word} illustrating a reading passage${title?.trim() ? ` titled "${title.trim()}"` : ''}. ${first ? `Scene based on: ${first}` : ''}`.trim();

/** Thứ tự kiểm tra theo trường dữ liệu có mặt trong bài */
const ADAPTERS: Array<{ has: (ex: Exercise) => boolean; a: BatchAdapter }> = [
  {
    has: (ex) => !!ex.matchingPictures,
    a: {
      kind: 'Matching Pictures', style: PHOTO_STYLE, aspectRatio: '4:3',
      // Ô ảnh = ảnh đã có nhãn + caption nhưng chưa có ảnh; prompt dựng từ caption (địa điểm / chủ đề)
      targets: (ex) => (ex.matchingPictures?.images || [])
        .filter((im) => !im.imageUrl && im.caption?.trim())
        .map((im) => ({ key: im.id, label: `Picture ${im.label} · ${im.caption!.trim()}`, prompt: `Realistic travel photograph of ${im.caption!.trim()}, one clear main subject, well composed.` })),
      needsImage: (ex) => (ex.matchingPictures?.images || []).some((im) => !im.imageUrl && im.caption?.trim()),
      basePrompt: () => '',
      apply: (ex) => ex,
      applyTarget: (ex, key, url) => ({ ...ex, matchingPictures: { ...ex.matchingPictures!, images: ex.matchingPictures!.images.map((im) => (im.id === key ? { ...im, imageUrl: url } : im)) } }),
    },
  },
  {
    has: (ex) => !!ex.readingMcq,
    a: {
      kind: 'Reading MCQ', style: PHOTO_STYLE, aspectRatio: '4:3',
      needsImage: (ex) => !!ex.readingMcq && ex.readingMcq.settings.showPassageImage && !ex.readingMcq.imageUrl,
      basePrompt: (ex) => {
        const d = ex.readingMcq!;
        return `Realistic documentary photo to illustrate a reading article titled "${d.passageTitle || d.exerciseTitle}". ${(splitParagraphs(d.passage)[0] || '').slice(0, 220)}`.trim();
      },
      apply: (ex, url) => ({ ...ex, readingMcq: { ...ex.readingMcq!, imageUrl: url, settings: { ...ex.readingMcq!.settings, showPassageImage: true } } }),
    },
  },
  {
    has: (ex) => !!ex.cloze,
    a: {
      kind: 'Cloze', style: PHOTO_STYLE, aspectRatio: '4:3',
      needsImage: (ex) => !!ex.cloze && ex.cloze.settings.imagePosition !== 'none' && !ex.cloze.settings.imageUrl,
      basePrompt: (ex) => scene('Photo', ex.cloze!.passageTitle, clean(ex.cloze!.passage || '', 260)),
      apply: (ex, url) => {
        const d = ex.cloze!;
        return { ...ex, cloze: { ...d, settings: { ...d.settings, imageUrl: url, imagePosition: d.settings.imagePosition === 'none' ? 'right' : d.settings.imagePosition } } };
      },
    },
  },
  {
    has: (ex) => !!ex.listeningGapFill,
    a: {
      kind: 'Listening Gap Fill', style: PHOTO_STYLE, aspectRatio: '4:3',
      needsImage: (ex) => !!ex.listeningGapFill && ex.listeningGapFill.settings.imagePosition !== 'none' && !ex.listeningGapFill.bodyImage?.url,
      basePrompt: (ex) => {
        const d = ex.listeningGapFill!;
        return scene('Illustration', d.passageTitle, clean(d.paragraphs?.[0]?.text || '', 240));
      },
      apply: (ex, url, prompt) => ({ ...ex, listeningGapFill: { ...ex.listeningGapFill!, bodyImage: { url, ratio: 4 / 3, prompt } } }),
    },
  },
  {
    has: (ex) => !!ex.matchingHeadings,
    a: {
      kind: 'Matching Headings', style: PHOTO_STYLE, aspectRatio: '4:3',
      needsImage: (ex) => !!ex.matchingHeadings && ex.matchingHeadings.settings.showImage && !ex.matchingHeadings.image?.url,
      basePrompt: (ex) => {
        const d = ex.matchingHeadings!;
        return scene('Photo', d.passageTitle, (d.paragraphs?.[0]?.text || '').replace(/\s+/g, ' ').slice(0, 260));
      },
      apply: (ex, url, prompt) => ({ ...ex, matchingHeadings: { ...ex.matchingHeadings!, image: { url, ratio: 4 / 3, prompt } } }),
    },
  },
  {
    has: (ex) => !!ex.tfng,
    a: {
      kind: 'True / False / Not Given', style: PHOTO_STYLE, aspectRatio: '4:3',
      needsImage: (ex) => !!ex.tfng && ex.tfng.settings.showImage && !ex.tfng.image.url,
      basePrompt: (ex) => buildTfngImagePrompt(ex.tfng!),
      apply: (ex, url, prompt) => ({ ...ex, tfng: { ...ex.tfng!, image: { ...ex.tfng!.image, url, ratio: 4 / 3, prompt }, settings: { ...ex.tfng!.settings, showImage: true } } }),
    },
  },
  {
    has: (ex) => !!ex.listeningTrueFalse,
    a: {
      kind: 'Listening True / False', style: PHOTO_STYLE, aspectRatio: '4:3',
      needsImage: (ex) => !!ex.listeningTrueFalse && ex.listeningTrueFalse.settings.showImage && !ex.listeningTrueFalse.image.url,
      basePrompt: (ex) => buildTfImagePrompt(ex.listeningTrueFalse!),
      apply: (ex, url, prompt) => ({ ...ex, listeningTrueFalse: { ...ex.listeningTrueFalse!, image: { ...ex.listeningTrueFalse!.image, url, ratio: 4 / 3, prompt }, settings: { ...ex.listeningTrueFalse!.settings, showImage: true } } }),
    },
  },
  {
    has: (ex) => !!ex.listeningTable,
    a: {
      kind: 'Listening Table', style: MAP_STYLE, aspectRatio: '16:9',
      needsImage: (ex) => !!ex.listeningTable && ex.listeningTable.settings.showImage && !ex.listeningTable.image.url,
      basePrompt: (ex) => buildTableImagePrompt(ex.listeningTable!),
      apply: (ex, url, prompt) => ({ ...ex, listeningTable: { ...ex.listeningTable!, image: { ...ex.listeningTable!.image, url, ratio: 16 / 9, prompt }, settings: { ...ex.listeningTable!.settings, showImage: true } } }),
    },
  },
];

export const adapterFor = (ex: Exercise): BatchAdapter | null => ADAPTERS.find((x) => x.has(ex))?.a ?? null;

export interface BatchCandidate {
  /** Khóa duy nhất của mục: exerciseId, hoặc exerciseId::key với bài nhiều ô ảnh */
  id: string;
  exerciseId: string;
  /** Ô ảnh trong bài (chỉ bài nhiều ô ảnh) */
  key?: string;
  title: string;
  /** Tên ô ảnh, ví dụ "Picture B · Madame Tussauds" */
  label?: string;
  kind: string;
  /** Prompt dựng sẵn khi bài tự biết chủ đề từng ô */
  prompt?: string;
}

/** Các ô ảnh còn thiếu trong folder (theo thứ tự bài, rồi thứ tự ô) */
export const findBatchCandidates = (exercises: Exercise[]): BatchCandidate[] =>
  exercises.flatMap((ex) => {
    const a = adapterFor(ex);
    if (!a) return [];
    if (a.targets) return a.targets(ex).map((t) => ({ id: `${ex.id}::${t.key}`, exerciseId: ex.id, key: t.key, title: ex.title, label: t.label, kind: a.kind, prompt: t.prompt }));
    return a.needsImage(ex) ? [{ id: ex.id, exerciseId: ex.id, title: ex.title, kind: a.kind }] : [];
  });

/** Gắn ảnh vào đúng ô của bài */
export const applyBatchImage = (ex: Exercise, c: BatchCandidate, url: string, prompt: string): Exercise => {
  const a = adapterFor(ex);
  if (!a) return ex;
  return c.key && a.applyTarget ? a.applyTarget(ex, c.key, url, prompt) : a.apply(ex, url, prompt);
};

/**
 * Nhờ AI đọc nội dung bài và viết prompt ảnh. Extension chưa nối, AI lỗi hoặc quá 60 giây thì dùng prompt dựng sẵn từ nội dung bài.
 */
export const analyzeImagePrompt = async (base: string): Promise<{ prompt: string; byAi: boolean }> => {
  const text = base.trim();
  try {
    const probe = await probeExtension();
    if (!probe.present) return { prompt: text, byAi: false };
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 60000));
    const out = await Promise.race([analyzeWorksheetWithAI(`Exercise 1: Picture for a worksheet\nImage needed: ${text}`), timeout]);
    const ai = out && out.ok ? out.plan?.images?.[0]?.prompt?.trim() : '';
    if (ai) return { prompt: ai.slice(0, 3000), byAi: true };
  } catch { /* dùng prompt dựng sẵn */ }
  return { prompt: text.slice(0, 3000), byAi: false };
};

// ── Danh sách mọi ô ảnh của folder (cả ô đã có ảnh) cho màn AI Image Studio ──

export interface ImageTarget {
  /** Khóa duy nhất: exerciseId::key */
  id: string;
  exerciseId: string;
  /** Số thứ tự bài trong folder (từ 1) */
  exNo: number;
  key: string;
  title: string;
  kind: string;
  /** Tên ô ảnh, ví dụ "Image A", "Picture B · Madame Tussauds" */
  label: string;
  url?: string;
  /** Prompt gợi ý dựng từ nội dung bài / chủ đề của ô */
  prompt: string;
  /** Ô ảnh AI đang chờ giáo viên duyệt */
  needsReview?: boolean;
  /** true: chưa có prompt riêng cho ô, nhờ AI phân tích nội dung bài khi tạo ảnh */
  analyze: boolean;
  style: string;
  aspectRatio: string;
}

/** Ô ảnh đơn của từng loại bài: ảnh hiện có và đang bật hiển thị ảnh hay không */
const singleInfo = (ex: Exercise): { url?: string; enabled: boolean } | null => {
  if (ex.readingMcq) return { url: ex.readingMcq.imageUrl, enabled: ex.readingMcq.settings.showPassageImage };
  if (ex.cloze) return { url: ex.cloze.settings.imageUrl, enabled: ex.cloze.settings.imagePosition !== 'none' };
  if (ex.listeningGapFill) return { url: ex.listeningGapFill.bodyImage?.url, enabled: ex.listeningGapFill.settings.imagePosition !== 'none' };
  if (ex.matchingHeadings) return { url: ex.matchingHeadings.image?.url, enabled: ex.matchingHeadings.settings.showImage };
  if (ex.tfng) return { url: ex.tfng.image.url, enabled: ex.tfng.settings.showImage };
  if (ex.listeningTrueFalse) return { url: ex.listeningTrueFalse.image.url, enabled: ex.listeningTrueFalse.settings.showImage };
  if (ex.listeningTable) return { url: ex.listeningTable.image.url, enabled: ex.listeningTable.settings.showImage };
  return null;
};

const SLOT_STYLE = 'Clean, high-contrast, black and white minimalist line art illustration for an English worksheet, white background, clear outlines, educational style, print-ready.';

export const listImageTargets = (exercises: Exercise[]): ImageTarget[] =>
  exercises.flatMap((ex, i) => {
    const base = { exerciseId: ex.id, exNo: i + 1, title: ex.title };
    const out: ImageTarget[] = [];
    const a = adapterFor(ex);
    if (a && ex.matchingPictures) {
      for (const im of ex.matchingPictures.images || []) {
        const cap = im.caption?.trim() || '';
        if (!im.imageUrl && !cap) continue;
        out.push({
          ...base, id: `${ex.id}::${im.id}`, key: im.id, kind: a.kind,
          label: `Image ${im.label}${cap ? ` · ${cap}` : ''}`, url: im.imageUrl || undefined,
          prompt: cap ? `Realistic travel photograph of ${cap}, one clear main subject, well composed.` : '', analyze: false, style: a.style, aspectRatio: a.aspectRatio,
        });
      }
    } else if (a) {
      const info = singleInfo(ex);
      if (info && (info.enabled || info.url)) {
        out.push({ ...base, id: `${ex.id}::main`, key: 'main', kind: a.kind, label: 'Image 1', url: info.url || undefined, prompt: a.basePrompt(ex), analyze: true, style: a.style, aspectRatio: a.aspectRatio });
      }
    }
    for (const s of ex.imageSlots || []) {
      const sub = s.caption?.trim() || `Illustration for ${ex.title}${s.label ? ` (Item ${s.label})` : ''}`;
      out.push({
        ...base, id: `${ex.id}::slot:${s.slotId}`, key: `slot:${s.slotId}`, kind: a?.kind || 'Image slot',
        label: `Image ${s.label ?? ''}`.trim(), url: s.assetUrl || undefined,
        needsReview: !!s.needsReview, prompt: `${SLOT_STYLE} Subject: ${sub}.`, analyze: false, style: '', aspectRatio: s.aspectRatio || '4:3',
      });
    }
    return out;
  });

/** Gắn ảnh vào đúng ô (theo key) của bài */
export const applyImageTarget = (ex: Exercise, t: ImageTarget, url: string, prompt: string): Exercise => {
  if (t.key.startsWith('slot:')) {
    const id = t.key.slice(5);
    return { ...ex, imageSlots: ex.imageSlots.map((s) => (s.slotId === id ? { ...s, assetUrl: url, status: 'assigned' as const, aiPrompt: prompt, needsReview: true } : s)) };
  }
  const a = adapterFor(ex);
  if (!a) return ex;
  return a.applyTarget && t.key !== 'main' ? a.applyTarget(ex, t.key, url, prompt) : a.apply(ex, url, prompt);
};

/** Xóa ảnh khỏi ô */
export const clearImageTarget = (ex: Exercise, t: ImageTarget): Exercise => {
  if (t.key.startsWith('slot:')) {
    const id = t.key.slice(5);
    return { ...ex, imageSlots: ex.imageSlots.map((s) => (s.slotId === id ? { ...s, assetUrl: undefined, status: 'empty' as const, needsReview: false } : s)) };
  }
  return applyImageTarget(ex, t, '', '');
};
