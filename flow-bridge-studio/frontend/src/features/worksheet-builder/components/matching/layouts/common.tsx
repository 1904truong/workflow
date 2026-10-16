import { useState } from 'react';
import type { MatchingData } from '../../../services/matching/matchingCore';

export interface LayoutProps {
  data: MatchingData;
}

const LINE_HEIGHT = { compact: 1.2, normal: 1.4, spacious: 1.75 } as const;
const ROW_GAP_MM = { compact: 2, normal: 4.5, spacious: 6.5 } as const;

export const useLayoutStyle = (data: MatchingData) => {
  const s = data.settings;
  return {
    fontSize: `${s.fontSizePt}pt`,
    lineHeight: LINE_HEIGHT[s.lineSpacing],
    rowGap: `${ROW_GAP_MM[s.lineSpacing]}mm`,
    columnGap: `${s.columnGapMm}mm`,
    // cùng kiểu chữ tròn của phiếu mẫu (Quicksand), tự lùi về Arial nếu chưa tải được font
    fontFamily: 'Quicksand, "Segoe UI", Arial, sans-serif',
    // lề thụt vào của danh sách so với tiêu đề bài, như phiếu mẫu
    indent: '6mm',
  };
};

/** Ảnh minh họa: ẩn hẳn nếu lỗi tải (không bao giờ in biểu tượng ảnh hỏng) */
export const SafeImage = ({
  url, grayscale, widthMm = 26, heightMm = 20, framed = false,
}: { url?: string; grayscale: boolean; widthMm?: number; heightMm?: number; framed?: boolean }) => {
  const [broken, setBroken] = useState(false);
  if (!url || broken) return null;
  return (
    <img
      src={url}
      alt=""
      onError={() => setBroken(true)}
      style={{
        width: `${widthMm}mm`, height: `${heightMm}mm`, objectFit: 'contain', flexShrink: 0,
        filter: grayscale ? 'grayscale(1) contrast(1.05)' : undefined,
        background: '#fff',
        ...(framed ? { border: '0.5pt solid #d4d4d4', borderRadius: '1.5mm', padding: '0.8mm' } : {}),
      }}
    />
  );
};

export const AnswerBox = ({ size = 10, children }: { size?: number; children?: React.ReactNode }) => (
  <span
    className="inline-flex items-center justify-center shrink-0"
    style={{ width: `${size}mm`, height: `${size * 0.85}mm`, border: '0.75pt solid #444', borderRadius: '1.2mm' }}
  >
    {children}
  </span>
);

export const keepTogether: React.CSSProperties = { breakInside: 'avoid', pageBreakInside: 'avoid' };
