// Nguồn ảnh cho nút "Tạo ảnh AI": Google Flow (AI tạo) hoặc kho ảnh Magnific / Pexels (người dùng tự chọn ảnh).
// Lưu ở module để mọi trình soạn dùng chung một lựa chọn, nhớ lại ở lần mở sau.

import { useSyncExternalStore } from 'react';

export type ImageProvider = 'flow' | 'magnific' | 'pexels';

export const PROVIDER_LABELS: Record<ImageProvider, string> = {
  flow: 'Google Flow (AI tạo ảnh)',
  magnific: 'Magnific (chọn ảnh)',
  pexels: 'Pexels (chọn ảnh)',
};
export const PROVIDER_SHORT: Record<ImageProvider, string> = { flow: 'Flow', magnific: 'Magnific', pexels: 'Pexels' };

const STORAGE_KEY = 'fb_image_provider';
const PREFS_KEY = 'fb_image_prefs';

const loadProvider = (): ImageProvider => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'magnific' || v === 'pexels' || v === 'flow') return v;
  } catch { /* không có localStorage */ }
  return 'flow';
};

/** Bộ lọc cho trang tìm ảnh (giá trị trùng tham số trên địa chỉ tìm kiếm của Magnific / Pexels); 'auto' = theo tỉ lệ ảnh của bài */
export interface StockFilters {
  orientation: 'auto' | 'landscape' | 'portrait' | 'square' | 'panoramic';
  fileType: 'jpg' | 'png';
  /** '' = không lọc */
  ai: '' | 'excluded' | 'only';
}

interface ImageSourceState {
  provider: ImageProvider;
  /** Từ khóa tìm ảnh (chỉ cho Magnific / Pexels); trống = tự rút từ nội dung bài */
  keyword: string;
  filters: StockFilters;
  /** Tỉ lệ khung hình khi tạo bằng Flow; '' = theo bài */
  flowRatio: '' | '1:1' | '4:3' | '3:4' | '16:9' | '9:16';
}

const DEFAULT_FILTERS: StockFilters = { orientation: 'auto', fileType: 'jpg', ai: '' };

const loadPrefs = (): Pick<ImageSourceState, 'filters' | 'flowRatio'> => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      return { filters: { ...DEFAULT_FILTERS, ...(v.filters || {}) }, flowRatio: v.flowRatio || '' };
    }
  } catch { /* bỏ qua */ }
  return { filters: { ...DEFAULT_FILTERS }, flowRatio: '' };
};

let state: ImageSourceState = { provider: loadProvider(), keyword: '', ...loadPrefs() };
const listeners = new Set<() => void>();

export const getImageSource = (): ImageSourceState => state;

export const setImageSource = (patch: Partial<ImageSourceState>): void => {
  state = { ...state, ...patch };
  if (patch.provider) {
    try { localStorage.setItem(STORAGE_KEY, patch.provider); } catch { /* bỏ qua */ }
  }
  if (patch.filters || patch.flowRatio !== undefined) {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ filters: state.filters, flowRatio: state.flowRatio })); } catch { /* bỏ qua */ }
  }
  listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

export const useImageSource = (): ImageSourceState => useSyncExternalStore(subscribe, getImageSource);

const STOP = new Set([
  'a', 'an', 'the', 'of', 'for', 'to', 'and', 'or', 'in', 'on', 'with', 'about', 'then', 'below', 'above', 'this', 'that', 'is', 'are',
  'illustration', 'photo', 'picture', 'image', 'scene', 'based', 'showing', 'shows', 'show', 'titled', 'title', 'exercise', 'listening', 'reading',
  'passage', 'article', 'answer', 'questions', 'question', 'topic', 'hints', 'realistic', 'documentary', 'simple', 'clear', 'choice',
]);

/** Rút vài từ khóa chính từ prompt dài để tìm trên kho ảnh (tối đa 5 từ) */
export const keywordFromPrompt = (prompt: string): string => {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u1ef9\s]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && /^[a-z]+$/.test(w) && !STOP.has(w)); // chỉ chữ tiếng Anh: bỏ từ tiếng Việt, số, "3x4" lẫn trong prompt
  return [...new Set(words)].slice(0, 5).join(' ');
};
