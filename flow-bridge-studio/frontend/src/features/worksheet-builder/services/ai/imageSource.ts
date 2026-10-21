// Nguồn ảnh cho nút "Tạo ảnh AI": Google Flow (AI tạo) hoặc kho ảnh Magnific / Pexels (người dùng tự chọn ảnh).
// Lưu ở module để mọi trình soạn dùng chung một lựa chọn, nhớ lại ở lần mở sau.

import { useSyncExternalStore } from 'react';

export type ImageProvider = 'flow' | 'chatgpt' | 'magnific' | 'pexels';

export const PROVIDER_LABELS: Record<ImageProvider, string> = {
  flow: 'Google Flow (AI generated)',
  chatgpt: 'ChatGPT (AI generated)',
  magnific: 'Magnific (pick image)',
  pexels: 'Pexels (pick image)',
};
export const PROVIDER_SHORT: Record<ImageProvider, string> = {
  flow: 'Flow',
  chatgpt: 'ChatGPT',
  magnific: 'Magnific',
  pexels: 'Pexels',
};

const STORAGE_KEY = 'fb_image_provider';
const PREFS_KEY = 'fb_image_prefs';

const loadProvider = (): ImageProvider => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'chatgpt' || v === 'magnific' || v === 'pexels' || v === 'flow') return v;
  } catch { /* không có localStorage */ }
  return 'flow';
};

/** Bộ lọc cho trang tìm ảnh (giá trị trùng tham số trên địa chỉ tìm kiếm của Magnific / Pexels); 'auto' = theo tỉ lệ ảnh của bài */
export interface StockFilters {
  orientation: 'auto' | 'landscape' | 'portrait' | 'square' | 'panoramic';
  /** '' = tất cả loại file. Chỉ JPG/PNG vào được bài; loại khác Magnific vẫn lọc nhưng không lưu được vào bài */
  fileType: '' | 'jpg' | 'png' | 'ai' | 'eps' | 'svg' | 'psd';
  /** '' = không lọc */
  ai: '' | 'excluded' | 'only';
  /** Bộ lọc người của Magnific: '' = tất cả, 'exclude' = không có người, 'include' = có người (kèm các lựa chọn bên dưới) */
  people: '' | 'exclude' | 'include';
  peopleRange: '' | '1' | '2' | '3' | '4';
  peopleGender: '' | 'male' | 'female';
  peopleAge: '' | 'infant' | 'child' | 'teen' | 'young-adult' | 'adult' | 'senior' | 'elder';
  peopleEthnicity: '' | 'south-asian' | 'middle-eastern' | 'east-asian' | 'black' | 'hispanic' | 'white' | 'multiracial';
  /** Màu chủ đạo và bối cảnh: thêm vào từ khóa tìm ảnh (Magnific chưa có tham số địa chỉ cho Color) */
  color: string;
  scenery: string;
  /** Pexels: cỡ ảnh và màu */
  size: '' | 'large' | 'medium' | 'small';
  pexelsColor: string;
  /** Mức chi tiết và số ảnh: chỉ lưu lại, chưa ảnh hưởng kết quả tìm kiếm ảnh có sẵn */
  detail: '' | 'high' | 'medium' | 'low';
  count: '1' | '2' | '3' | '4';
}

interface ImageSourceState {
  provider: ImageProvider;
  /** Từ khóa tìm ảnh (chỉ cho Magnific / Pexels); trống = tự rút từ nội dung bài */
  keyword: string;
  filters: StockFilters;
  /** Tỉ lệ khung hình khi tạo bằng Flow hoặc ChatGPT; '' = theo bài */
  flowRatio: '' | '1:1' | '4:3' | '3:4' | '16:9' | '9:16';
  /** Tỉ lệ khung hình khi tìm ảnh (Magnific/Pexels); '' = theo bài. Dùng để suy hướng ảnh khi hướng ảnh để "theo tỉ lệ của bài" */
  stockRatio: '' | '1:1' | '4:3' | '3:4' | '16:9' | '9:16';
  /** Mức suy luận ChatGPT (1 = Instant, 2 = Medium, 3 = High) */
  chatgptEffort: number;
}

const DEFAULT_FILTERS: StockFilters = { orientation: 'auto', fileType: 'jpg', ai: '', people: '', peopleRange: '', peopleGender: '', peopleAge: '', peopleEthnicity: '', color: '', scenery: '', size: '', pexelsColor: '', detail: 'high', count: '1' };

const loadPrefs = (): Pick<ImageSourceState, 'filters' | 'flowRatio' | 'stockRatio' | 'chatgptEffort'> => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      return {
        filters: { ...DEFAULT_FILTERS, ...(v.filters || {}) },
        flowRatio: v.flowRatio || '',
        stockRatio: v.stockRatio || '',
        chatgptEffort: v.chatgptEffort ? Number(v.chatgptEffort) : 1,
      };
    }
  } catch { /* bỏ qua */ }
  return { filters: { ...DEFAULT_FILTERS }, flowRatio: '', stockRatio: '', chatgptEffort: 1 };
};

let state: ImageSourceState = { provider: loadProvider(), keyword: '', ...loadPrefs() };
try { const saved = JSON.parse(localStorage.getItem('fb_image_prov_prefs') || '{}')[state.provider]; if (saved) state = { ...state, ...saved }; } catch { /* bỏ qua */ }
const listeners = new Set<() => void>();

export const getImageSource = (): ImageSourceState => state;

// Mỗi nguồn ảnh (Magnific, Pexels, ...) giữ riêng từ khóa, bộ lọc và tỉ lệ; đổi nguồn thì nạp lại phần của nguồn đó
const PROV_KEY = 'fb_image_prov_prefs';
type ProvSlice = Pick<ImageSourceState, 'keyword' | 'filters' | 'stockRatio'>;
const perProv: Record<string, ProvSlice> = (() => { try { return JSON.parse(localStorage.getItem(PROV_KEY) || '{}'); } catch { return {}; } })();

export const setImageSource = (patch: Partial<ImageSourceState>): void => {
  if (patch.provider && patch.provider !== state.provider) {
    perProv[state.provider] = { keyword: state.keyword, filters: state.filters, stockRatio: state.stockRatio };
    const next = perProv[patch.provider] || { keyword: '', filters: { ...DEFAULT_FILTERS }, stockRatio: '' };
    state = { ...state, ...next };
  }
  state = { ...state, ...patch };
  perProv[state.provider] = { keyword: state.keyword, filters: state.filters, stockRatio: state.stockRatio };
  try { localStorage.setItem(PROV_KEY, JSON.stringify(perProv)); } catch { /* bỏ qua */ }
  if (patch.provider) {
    try { localStorage.setItem(STORAGE_KEY, patch.provider); } catch { /* bỏ qua */ }
  }
  if (patch.filters || patch.flowRatio !== undefined || patch.stockRatio !== undefined || patch.chatgptEffort !== undefined) {
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ filters: state.filters, flowRatio: state.flowRatio, stockRatio: state.stockRatio, chatgptEffort: state.chatgptEffort })
      );
    } catch { /* bỏ qua */ }
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
  'passage', 'article', 'illustrating', 'illustrate', 'having', 'have', 'has', 'say', 'your', 'you', 'our', 'from', 'into', 'each', 'their', 'them', 'its', 'was', 'were', 'will', 'can', 'not', 'but', 'all', 'any', 'edition', 'answer', 'questions', 'question', 'topic', 'hints', 'realistic', 'documentary', 'simple', 'clear', 'choice',
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
