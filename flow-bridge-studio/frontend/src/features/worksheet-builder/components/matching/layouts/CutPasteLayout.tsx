import type { LayoutProps } from './common';
import { useLayoutStyle, SafeImage, AnswerBox, keepTogether } from './common';
import { solutionLabel } from '../../../services/matching/matchingCore';

/**
 * Template 5: thẻ cắt dán.
 * cutMode 'cut': thẻ solution viền đứt (cắt), problem có ô trống để dán.
 * cutMode 'write': học sinh chỉ viết chữ cái vào ô; không viền cắt.
 */
export const CutPasteLayout = ({ data }: LayoutProps) => {
  const st = useLayoutStyle(data);
  const cut = data.settings.cutMode === 'cut';
  const num = data.settings.showNumbering;
  return (
    <div className="w-full grid" style={{ gridTemplateColumns: '1fr 1.15fr', columnGap: st.columnGap, fontSize: st.fontSize, lineHeight: st.lineHeight, fontFamily: st.fontFamily }}>
      <div className="flex flex-col" style={{ rowGap: st.rowGap }}>
        {data.problems.map((p, i) => (
          <div key={p.id} className="flex items-center gap-[2mm]" style={keepTogether}>
            <div className="flex-1 flex items-center gap-[2mm] px-[3mm] py-[2.5mm]" style={{ border: '0.9pt solid #222', borderRadius: '1.8mm' }}>
              {num && <span className="font-bold">{i + 1}.</span>}
              <SafeImage url={p.imageUrl} grayscale={data.settings.grayscale} widthMm={20} heightMm={15} />
              <span>{p.text}</span>
            </div>
            {cut ? (
              <span
                className="inline-flex items-center justify-center shrink-0"
                style={{ width: '30mm', height: '14mm', border: '0.75pt solid #888', borderRadius: '1.5mm' }}
              >
              </span>
            ) : (
              data.settings.showAnswerBoxes && (
                <AnswerBox size={12} />
              )
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col pl-[4mm]" style={{ rowGap: cut ? '4mm' : st.rowGap, borderLeft: '0.75pt solid #999' }}>
        {data.solutions.map((s, i) => (
          <div
            key={s.id}
            className="flex items-start gap-[2mm]"
            style={{
              ...keepTogether,
              ...(cut ? { border: '1pt dashed #444', borderRadius: '2mm', padding: '3mm' } : {}),
            }}
          >
            {num && <span className="font-bold min-w-[5mm]">{solutionLabel(i)}.</span>}
            <SafeImage url={s.imageUrl} grayscale={data.settings.grayscale} />
            <span>{s.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
