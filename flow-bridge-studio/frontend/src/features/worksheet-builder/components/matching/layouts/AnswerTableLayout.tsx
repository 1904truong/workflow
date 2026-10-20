import type { LayoutProps } from './common';
import { useLayoutStyle, SafeImage, keepTogether } from './common';
import { solutionLabel } from '../../../services/matching/matchingCore';

/** Template 3: bảng đáp án + danh sách solution gọn 2 cột bên dưới. */
export const AnswerTableLayout = ({ data }: LayoutProps) => {
  const st = useLayoutStyle(data);
  const last = data.solutions.length ? solutionLabel(data.solutions.length - 1) : 'a';
  const cell: React.CSSProperties = { border: '0.5pt solid #333', padding: '1.6mm 2.4mm' };
  return (
    <div className="w-full" style={{ fontSize: st.fontSize, lineHeight: st.lineHeight, fontFamily: st.fontFamily }}>
      <table className="w-full" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f2f2f2' }}>
            <th style={{ ...cell, width: '12mm' }}>No.</th>
            <th style={cell}>Problem</th>
            <th style={{ ...cell, width: '38mm' }}>Solution (a–{last})</th>
          </tr>
        </thead>
        <tbody>
          {data.problems.map((p, i) => (
            <tr key={p.id} style={keepTogether}>
              <td style={{ ...cell, textAlign: 'center', fontWeight: 700 }}>{i + 1}</td>
              <td style={cell}>
                <span className="inline-flex items-center gap-[2mm]">
                  <SafeImage url={p.imageUrl} grayscale={data.settings.grayscale} widthMm={18} heightMm={13} />
                  <span>{p.text}</span>
                </span>
              </td>
              <td style={{ ...cell, textAlign: 'center' }}>
                {data.settings.showAnswerBoxes && <span className="inline-block align-bottom" style={{ width: '20mm', borderBottom: '1pt dashed #333', height: '1.2em' }} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-[3mm] p-[2.5mm]" style={{ border: '0.5pt solid #888', borderRadius: '1.5mm', columnCount: 2, columnGap: st.columnGap }}>
        {data.solutions.map((s, i) => (
          <div key={s.id} className="flex items-start gap-[2mm]" style={{ ...keepTogether, fontSize: '0.92em', marginBottom: '0.8mm' }}>
            <span className="font-bold min-w-[5mm]">{solutionLabel(i)}.</span>
            <span>{s.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
