// Dữ liệu cho bài Listening Multiple Choice: dùng lại toàn bộ mô hình câu hỏi / lựa chọn / layout của Grammar MCQ,
// thêm audio + mã QR. Giáo trình: KHÔNG có đáp án, học sinh tự khoanh.

import type { ListeningAudio } from '../listening/listeningGapFillCore.ts';
import type { GrammarMcqData, GrammarMcqSettings } from '../grammar-mcq/grammarMcqCore.ts';
import { DEFAULT_MCQ_SETTINGS, MCQ_LAYOUTS, createGrammarMcq, validateGrammarMcq } from '../grammar-mcq/grammarMcqCore.ts';
import type { McqLayoutMeta } from '../grammar-mcq/grammarMcqCore.ts';

/** Các layout của Listening MC = layout của Grammar MCQ + layout chọn đáp án bằng hình ảnh A / B / C */
export const LISTENING_MCQ_LAYOUTS: McqLayoutMeta[] = [
  ...MCQ_LAYOUTS,
  { id: 'pictures', label: 'Pictures (A / B / C)', desc: 'Nghe và chọn đáp án bằng hình: mỗi câu có 3 ảnh xếp hàng ngang, chữ A, B, C nằm dưới ảnh' },
];

export interface ListeningMcqSettings extends GrammarMcqSettings {
  showAudioIcon: boolean;
  showQrCode: boolean;
}

export interface ListeningMcqData extends Omit<GrammarMcqData, 'settings'> {
  audio: ListeningAudio;
  settings: ListeningMcqSettings;
}

export const EMPTY_LMCQ_AUDIO: ListeningAudio = {
  filename: 'No audio attached',
  sizeMb: '0 MB',
  durationStr: '00:00',
};

export const DEFAULT_LISTENING_MCQ_SETTINGS: ListeningMcqSettings = {
  ...DEFAULT_MCQ_SETTINGS,
  fontSizePt: 11,
  lineHeight: 1.45,
  questionGapMm: 4,
  optionColumns: 1,
  showInstruction: false,
  showAudioIcon: true,
  showQrCode: true,
};

export const createListeningMcq = (partial?: Partial<ListeningMcqData>): ListeningMcqData => {
  const { audio, settings, ...rest } = partial || {};
  const base = createGrammarMcq({ exerciseTitle: 'LISTEN AND CHOOSE THE CORRECT ANSWER', instruction: 'Listen and choose the correct answer.', ...rest } as Partial<GrammarMcqData>);
  return {
    ...base,
    audio: { ...EMPTY_LMCQ_AUDIO, ...(audio || {}) },
    settings: { ...DEFAULT_LISTENING_MCQ_SETTINGS, ...(settings || {}) },
  };
};

export const validateListeningMcq = (d: ListeningMcqData): { errors: string[]; warnings: string[] } => {
  const r = validateGrammarMcq(d as unknown as GrammarMcqData);
  const warnings = [...r.warnings];
  if (d.settings.showQrCode && !d.audio.shareUrl) warnings.push('Chưa có đường dẫn audio nên mã QR chưa dùng được.');
  return { errors: r.errors, warnings };
};
