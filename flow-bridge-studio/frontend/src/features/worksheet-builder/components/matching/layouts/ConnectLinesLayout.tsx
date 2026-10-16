import type { LayoutProps } from './common';
import { useLayoutStyle, SafeImage, keepTogether } from './common';
import { solutionLabel } from '../../../services/matching/matchingCore';

const Dot = () => (
  <span className="inline-block shrink-0 rounded-full bg-black" style={{ width: '1.7mm', height: '1.7mm' }} />
);

/**
 * Template 2: nối chấm.
 * Hai cột cao bằng nhau và các mục dàn đều (space-between) nên khoảng cách giữa các chấm đều nhau.
 * Chấm luôn căn giữa dòng đầu của mục (hoặc giữa ảnh nếu có ảnh), kể cả khi chữ xuống dòng.
 */
export const ConnectLinesLayout = ({ data }: LayoutProps) => {
  const st = useLayoutStyle(data);
  const num = data.settings.showNumbering;
  const firstLine = { height: `${st.lineHeight}em` } as const;
  return (
    <div className="w-full grid" style={{ gridTemplateColumns: '1fr 34mm 1fr', fontSize: st.fontSize, lineHeight: st.lineHeight, fontFamily: st.fontFamily }}>
      <div className="flex flex-col justify-between" style={{ rowGap: st.rowGap }}>
        {data.problems.map((p, i) => (
          <div key={p.id} className={`flex gap-[2mm] ${p.imageUrl ? 'items-center' : 'items-start'}`} style={keepTogether}>
            {num && <span className="font-bold min-w-[6mm]">{i + 1}.</span>}
            <SafeImage url={p.imageUrl} grayscale={data.settings.grayscale} widthMm={30} heightMm={22} />
            <span className="flex-1">{p.text}</span>
            <span className="flex items-center" style={p.imageUrl ? undefined : firstLine}><Dot /></span>
          </div>
        ))}
      </div>
      <div aria-hidden="true" />
      <div className="flex flex-col justify-between" style={{ rowGap: st.rowGap }}>
        {data.solutions.map((s, i) => (
          <div key={s.id} className={`flex gap-[2mm] ${s.imageUrl ? 'items-center' : 'items-start'}`} style={keepTogether}>
            <span className="flex items-center" style={s.imageUrl ? undefined : firstLine}><Dot /></span>
            {num && <span className="font-bold min-w-[5mm]">{solutionLabel(i)}.</span>}
            <SafeImage url={s.imageUrl} grayscale={data.settings.grayscale} widthMm={24} heightMm={18} />
            <span className="flex-1">{s.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
