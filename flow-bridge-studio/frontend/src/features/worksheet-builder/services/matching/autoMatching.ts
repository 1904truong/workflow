// Tự động hóa Smart Paste cho bài Matching: chọn layout theo nội dung + gợi ý của AI, rồi tự tạo ảnh qua extension.
// Logic thuần (không đụng window): việc gọi extension được truyền vào để dễ kiểm thử.

import type { MatchingData, MatchingLayoutId, ParsedMatching } from './matchingCore.ts';
import type { AiAspectRatio, AiImagePlan } from '../ai/imagePlanSchema.ts';
import { buildFinalPrompt, DEFAULT_STYLE_SUFFIX } from '../ai/imagePlanCompare.ts';

/** Ảnh chụp thật (bài đọc về địa điểm, nhân vật) – khác với tranh nét đen trắng của các bài ghép ảnh */
export const PHOTO_STYLE =
  'Realistic editorial travel photograph, natural lighting, sharp focus, no text, no letters, no numbers, no watermark, no captions.';

export type AutoTargetKind = 'block' | 'problem' | 'solution';

export interface AutoImageTarget {
  kind: AutoTargetKind;
  id: string;
  /** Tên ngắn hiển thị cho giáo viên */
  subject: string;
  /** Prompt chủ thể (chưa gồm phong cách chung) */
  prompt: string;
  aspectRatio: AiAspectRatio;
  style: 'photo' | 'line_art';
}

export interface AutoImageItem extends AutoImageTarget {
  status: 'queued' | 'running' | 'done' | 'failed';
  error?: string;
}

export const FRAME_WIDTH_MM = 48;
const RATIOS: { label: AiAspectRatio; ratio: number }[] = [
  { label: '16:9', ratio: 16 / 9 },
  { label: '4:3', ratio: 4 / 3 },
  { label: '1:1', ratio: 1 },
  { label: '3:4', ratio: 3 / 4 },
];

/** Nhãn tỉ lệ gần nhất mà bộ tạo ảnh hỗ trợ */
export const nearestAspect = (ratio: number): AiAspectRatio =>
  RATIOS.reduce((best, r) => (Math.abs(r.ratio - ratio) < Math.abs(best.ratio - ratio) ? r : best)).label;

/** Tự chọn khung ảnh vừa với khối chữ: chữ dài thì khung cao hơn, chữ ngắn thì khung rộng và thấp */
export function chooseBlockFrame(text: string): { label: AiAspectRatio; ratio: number } {
  const plain = text.replace(/\*\*/g, '');
  const paragraphs = plain.split(/\n\s*\n/).filter((p) => p.trim()).length;
  const lines = Math.ceil(plain.length / 80) + paragraphs;
  const textHeightMm = Math.min(64, Math.max(20, lines * 5.4));
  const best = RATIOS.reduce((b, r) =>
    Math.abs(FRAME_WIDTH_MM / r.ratio - textHeightMm) < Math.abs(FRAME_WIDTH_MM / b.ratio - textHeightMm) ? r : b);
  return { label: best.label, ratio: best.ratio };
}

/** Đổi lỗi kỹ thuật của extension thành lời nhắc dễ hiểu */
export function friendlyExtensionError(msg: string): string {
  if (/context invalidated|receiving end does not exist|EXTENSION_UNAVAILABLE/i.test(msg)) {
    return 'Extension vừa được bật hoặc tải lại nên trang này đang giữ bản cũ. Bấm F5 để tải lại trang rồi thử lại.';
  }
  return msg;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Chọn layout từ nội dung đã tách + gợi ý của AI (nếu có). Chỉ chọn trong các layout đã có sẵn. */
export function decideLayout(
  parsed: ParsedMatching,
  plan: AiImagePlan | null | undefined,
  current: MatchingLayoutId,
): { layout: MatchingLayoutId; reason: string } {
  if (parsed.reading && parsed.reading.length > 0) {
    return { layout: 'reading_images', reason: `Có ${parsed.reading.length} khối bài đọc (Name/Location) → Reading + Images` };
  }
  if (parsed.title && /draw\s+lines?/i.test(parsed.title)) {
    return { layout: 'facing_tables', reason: 'Tiêu đề có "Draw Lines" → Facing Tables' };
  }
  const ex = plan?.exercises[0];
  if (plan && ex?.needsImages && plan.images.length > 0) {
    return { layout: 'image_matching', reason: `AI: ${ex.reason || 'bài cần ảnh minh họa'} → Image Matching` };
  }
  if (current === 'reading_images') {
    return { layout: 'two_columns', reason: 'Không có bài đọc → Two Columns' };
  }
  return { layout: current, reason: 'Giữ layout hiện tại (không cần ảnh)' };
}

/** Prompt dự phòng, tạo từ chính nội dung khối khi AI không dùng được */
export function buildLocalPrompt(name: string, location: string, text: string): string {
  const plain = text.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  const firstSentence = (plain.split(/(?<=[.!?])\s/)[0] || '').replace(/^(Then|Now|Today|Later)\s*:\s*/i, '').slice(0, 220);
  const place = [name, location].filter(Boolean).join(', ');
  return `${place ? `${place}. ` : ''}${firstSentence ? `Scene based on this description: ${firstSentence}` : 'Show the place described in the reading text'}`.trim();
}

/** Danh sách ảnh cần tạo (bỏ qua mục đã có ảnh). Ưu tiên prompt của AI, thiếu thì tự sinh từ nội dung. */
export function planTargets(data: MatchingData, plan: AiImagePlan | null | undefined): AutoImageTarget[] {
  const planImages = plan?.images.filter((im) => im.exerciseIndex === (plan.exercises[0]?.index ?? 1)) ?? [];

  if (data.layout === 'reading_images') {
    const blocks = data.reading || [];
    const used = new Set<number>();
    return blocks.flatMap((b, i): AutoImageTarget[] => {
      if (b.imageUrl) return [];
      const key = norm(b.name || '');
      let k = key ? planImages.findIndex((im, j) => !used.has(j) && (norm(im.subject).includes(key) || key.includes(norm(im.subject)) || norm(im.prompt).includes(key))) : -1;
      if (k < 0 && planImages.length === blocks.length && !used.has(i)) k = i;
      if (k >= 0) used.add(k);
      const fromAi = k >= 0 ? planImages[k] : null;
      return [{
        kind: 'block' as const,
        id: b.id,
        subject: b.name || `Khối ${i + 1}`,
        prompt: b.imagePrompt?.trim() || fromAi?.prompt || buildLocalPrompt(b.name || '', b.location || '', b.text),
        aspectRatio: (b.imageRatio ? nearestAspect(b.imageRatio) : chooseBlockFrame(b.text).label) as AiAspectRatio,
        style: 'photo' as const,
      }];
    });
  }

  if (data.layout === 'image_matching') {
    return planImages.flatMap((im): AutoImageTarget[] => {
      const q = im.relatedQuestionNumbers[0];
      const problem = q ? data.problems[q - 1] : undefined;
      const solIdx = /^[a-z]$/i.test(im.label) ? im.label.toLowerCase().charCodeAt(0) - 97 : -1;
      const solution = !problem && solIdx >= 0 ? data.solutions[solIdx] : undefined;
      if (problem && !problem.imageUrl) {
        return [{ kind: 'problem' as const, id: problem.id, subject: im.subject, prompt: im.prompt, aspectRatio: im.aspectRatio, style: 'line_art' as const }];
      }
      if (solution && !solution.imageUrl) {
        return [{ kind: 'solution' as const, id: solution.id, subject: im.subject, prompt: im.prompt, aspectRatio: im.aspectRatio, style: 'line_art' as const }];
      }
      return [];
    });
  }
  return [];
}

export const finalPrompt = (t: AutoImageTarget): string =>
  buildFinalPrompt(t.prompt, t.style === 'photo' ? PHOTO_STYLE : DEFAULT_STYLE_SUFFIX);

/** Gắn ảnh vào đúng mục; trả về dữ liệu mới (không sửa bản cũ) */
export function applyImage(data: MatchingData, t: Pick<AutoImageTarget, 'kind' | 'id'>, imageUrl: string): MatchingData {
  if (t.kind === 'block') {
    return { ...data, reading: (data.reading || []).map((b) => (b.id === t.id ? { ...b, imageUrl } : b)) };
  }
  if (t.kind === 'problem') {
    return { ...data, problems: data.problems.map((p) => (p.id === t.id ? { ...p, imageUrl } : p)) };
  }
  return { ...data, solutions: data.solutions.map((s) => (s.id === t.id ? { ...s, imageUrl } : s)) };
}

export interface RunAutoOptions {
  targets: AutoImageTarget[];
  getValue: () => MatchingData;
  apply: (next: MatchingData) => void;
  generate: (opts: { prompt: string; aspectRatio: string }) => Promise<{ imageUrl: string }>;
  onProgress: (items: AutoImageItem[]) => void;
  isCancelled: () => boolean;
}

/** Tạo lần lượt từng ảnh, gắn ngay khi xong. Một ảnh lỗi không làm dừng các ảnh còn lại. */
export async function runAutoImages(o: RunAutoOptions): Promise<AutoImageItem[]> {
  const items: AutoImageItem[] = o.targets.map((t) => ({ ...t, status: 'queued' as const }));
  o.onProgress([...items]);
  for (let i = 0; i < items.length; i++) {
    if (o.isCancelled()) break;
    items[i] = { ...items[i], status: 'running' };
    o.onProgress([...items]);
    try {
      const res = await o.generate({ prompt: finalPrompt(items[i]), aspectRatio: items[i].aspectRatio });
      if (o.isCancelled()) { items[i] = { ...items[i], status: 'queued' }; break; }
      o.apply(applyImage(o.getValue(), items[i], res.imageUrl));
      items[i] = { ...items[i], status: 'done' };
    } catch (e: unknown) {
      const msg = friendlyExtensionError(e instanceof Error ? e.message : 'Không tạo được ảnh');
      items[i] = { ...items[i], status: 'failed', error: msg };
    }
    o.onProgress([...items]);
  }
  return items;
}

/** Lưu prompt đã sinh vào các khối bài đọc chưa có prompt (để giáo viên xem / sửa / tạo lại sau) */
export function withPrompts(data: MatchingData, targets: AutoImageTarget[]): MatchingData {
  const byId = new Map(targets.filter((t) => t.kind === 'block').map((t) => [t.id, t] as const));
  if (byId.size === 0) return data;
  return {
    ...data,
    reading: (data.reading || []).map((b) => {
      const t = byId.get(b.id);
      if (!t) return b;
      const ratio = b.imageRatio || chooseBlockFrame(b.text).ratio;
      return { ...b, imagePrompt: b.imagePrompt || t.prompt, imageRatio: ratio };
    }),
  };
}
