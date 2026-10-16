import type { LayoutProps } from './common';
import { useLayoutStyle, SafeImage, AnswerBox, keepTogether } from './common';
import { solutionLabel } from '../../../services/matching/matchingCore';

/** Template 6: mỗi problem có thể có hình minh họa (tải lên); mặc định in trắng đen. Không tự chèn ảnh. */
export const ImageMatchingLayout = ({ data }: LayoutProps) => {
  const st = useLayoutStyle(data);
  const num = data.settings.showNumbering;
  // mặc định của layout này là trắng đen trừ khi người dùng đã chủ động bật màu (grayscale=false được lưu rõ)
  const gray = data.settings.grayscale;
  return (
    <div className="w-full grid" style={{ gridTemplateColumns: '1fr 1.1fr', columnGap: st.columnGap, fontSize: st.fontSize, lineHeight: st.lineHeight, fontFamily: st.fontFamily }}>
      {/* Problems: ảnh không khung, ô trả lời ngay cạnh ảnh; dàn đều theo chiều cao cột solutions */}
      <div className="flex flex-col justify-around" style={{ rowGap: st.rowGap }}>
        {data.problems.map((p, i) => (
          <div key={p.id} className="flex items-center gap-[4mm]" style={keepTogether}>
            {num && <span className="font-bold min-w-[6mm]">{i + 1}.</span>}
            <SafeImage url={p.imageUrl} grayscale={gray} widthMm={40} heightMm={26} />
            {p.text && <span>{p.text}</span>}
            {data.settings.showAnswerBoxes && (
              <AnswerBox size={12} />
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-col pl-[5mm]" style={{ rowGap: st.rowGap, borderLeft: '0.6pt solid #cfcfcf' }}>
        {data.solutions.map((s, i) => (
          <div key={s.id} className="flex items-start gap-[2mm]" style={keepTogether}>
            {num && <span className="font-bold min-w-[5mm]">{solutionLabel(i)}.</span>}
            <SafeImage url={s.imageUrl} grayscale={gray} widthMm={24} heightMm={18} />
            <span>{s.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
