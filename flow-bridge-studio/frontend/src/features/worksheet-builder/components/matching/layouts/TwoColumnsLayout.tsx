import type { LayoutProps } from './common';
import { useLayoutStyle, SafeImage, keepTogether } from './common';
import { solutionLabel } from '../../../services/matching/matchingCore';

/** Template 1: hai cột (giống PDF gốc). Không vẽ sẵn đường nối. */
export const TwoColumnsLayout = ({ data }: LayoutProps) => {
  const st = useLayoutStyle(data);
  const num = data.settings.showNumbering;
  return (
    <div className="w-full grid" style={{ gridTemplateColumns: '1fr 1fr', columnGap: st.columnGap, fontSize: st.fontSize, lineHeight: st.lineHeight, fontFamily: st.fontFamily }}>
      <div className="flex flex-col" style={{ rowGap: st.rowGap }}>
        {data.problems.map((p, i) => (
          <div key={p.id} className="flex items-start gap-[2mm]" style={keepTogether}>
            {num && <span className="font-bold min-w-[11mm]">{i + 1}.</span>}
            <div className="flex-1 flex items-center gap-[2mm]">
              <SafeImage url={p.imageUrl} grayscale={data.settings.grayscale} />
              <span>{p.text}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col pl-[4mm]" style={{ rowGap: st.rowGap }}>
        {data.solutions.map((s, i) => (
          <div key={s.id} className="flex items-start gap-[2mm]" style={keepTogether}>
            {num && <span className="font-bold min-w-[9mm]">{solutionLabel(i)}.</span>}
            <SafeImage url={s.imageUrl} grayscale={data.settings.grayscale} />
            <span>{s.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
