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
}

const clean = (t: string, n: number) => t.replace(/\(\w+\)\s*_{2,}/g, '').replace(/[*+]{1,2}/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const scene = (word: string, title: string | undefined, first: string) =>
  `${word} illustrating a reading passage${title?.trim() ? ` titled "${title.trim()}"` : ''}. ${first ? `Scene based on: ${first}` : ''}`.trim();

/** Thứ tự kiểm tra theo trường dữ liệu có mặt trong bài */
const ADAPTERS: Array<{ has: (ex: Exercise) => boolean; a: BatchAdapter }> = [
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
  exerciseId: string;
  title: string;
  kind: string;
}

/** Các bài trong folder còn thiếu ảnh (theo thứ tự trong folder) */
export const findBatchCandidates = (exercises: Exercise[]): BatchCandidate[] =>
  exercises.flatMap((ex) => {
    const a = adapterFor(ex);
    return a && a.needsImage(ex) ? [{ exerciseId: ex.id, title: ex.title, kind: a.kind }] : [];
  });

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
