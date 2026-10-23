import type { LayoutProps } from './common';
import { useLayoutStyle, SafeImage, keepTogether } from './common';
import { solutionLabel } from '../../../services/matching/matchingCore';

/**
 * Layout: Facing Tables (Draw Lines and Match)
 * Hai bảng kẻ ô đối xứng:
 * - Bảng trái: câu hỏi bên trái, số thứ tự (1, 2, 3...) đóng khung ở mép phải (hướng vào giữa)
 * - Khoảng trống ở giữa: đủ rộng để học sinh kẻ đường nối
 * - Bảng phải: chữ cái (A, B, C...) đóng khung ở mép trái, câu trả lời bên phải
 * - Từng hàng ở 2 bên thẳng hàng tuyệt đối với nhau
 */
export const FacingTablesLayout = ({ data }: LayoutProps) => {
  const st = useLayoutStyle(data);
  const maxRows = Math.max(data.problems.length, data.solutions.length);
  const borderColor = data.settings.grayscale ? '#555555' : '#df7a38';
  const border = `0.85pt solid ${borderColor}`;
  const gutterMm = Math.max(data.settings.columnGapMm ?? 28, 22);

  return (
    <div
      className="w-full flex flex-col"
      style={{
        fontSize: st.fontSize,
        lineHeight: st.lineHeight,
        fontFamily: st.fontFamily,
      }}
    >
      {Array.from({ length: maxRows }).map((_, i) => {
        const p = data.problems[i];
        const s = data.solutions[i];
        const isFirst = i === 0;

        return (
          <div
            key={p?.id || s?.id || i}
            className="grid items-stretch"
            style={{
              gridTemplateColumns: `minmax(0, 1fr) 8.5mm ${gutterMm}mm 8.5mm minmax(0, 1fr)`,
              ...keepTogether,
            }}
          >
            {/* ── Bảng trái (Problems): Câu hỏi | Số thứ tự ── */}
            {p ? (
              <>
                <div
                  className="flex items-center gap-[2mm]"
                  style={{
                    padding: '2mm 3mm',
                    borderLeft: border,
                    borderRight: border,
                    borderTop: isFirst ? border : 'none',
                    borderBottom: border,
                  }}
                >
                  <SafeImage url={p.imageUrl} grayscale={data.settings.grayscale} widthMm={20} heightMm={15} />
                  <span className="flex-1 leading-snug">{p.text}</span>
                </div>
                <div
                  className="flex items-center justify-center font-semibold text-slate-800"
                  style={{
                    borderRight: border,
                    borderTop: isFirst ? border : 'none',
                    borderBottom: border,
                    fontSize: '1em',
                  }}
                >
                  {i + 1}
                </div>
              </>
            ) : (
              <>
                <div aria-hidden="true" />
                <div aria-hidden="true" />
              </>
            )}

            {/* ── Khoảng trống ở giữa để học sinh kẻ đường nối ── */}
            <div aria-hidden="true" />

            {/* ── Bảng phải (Solutions): Chữ cái | Câu trả lời ── */}
            {s ? (
              <>
                <div
                  className="flex items-center justify-center font-semibold text-slate-800"
                  style={{
                    borderLeft: border,
                    borderRight: border,
                    borderTop: isFirst ? border : 'none',
                    borderBottom: border,
                    fontSize: '1em',
                  }}
                >
                  {solutionLabel(i).toUpperCase()}
                </div>
                <div
                  className="flex items-center gap-[2mm]"
                  style={{
                    padding: '2mm 3mm',
                    borderRight: border,
                    borderTop: isFirst ? border : 'none',
                    borderBottom: border,
                  }}
                >
                  <SafeImage url={s.imageUrl} grayscale={data.settings.grayscale} widthMm={20} heightMm={15} />
                  <span className="flex-1 leading-snug">{s.text}</span>
                </div>
              </>
            ) : (
              <>
                <div aria-hidden="true" />
                <div aria-hidden="true" />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};
