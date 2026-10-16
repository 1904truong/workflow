import type { LayoutProps } from './common';
import { useLayoutStyle, AnswerBox, keepTogether } from './common';
import { solutionLabel } from '../../../services/matching/matchingCore';

const IMG_W_MM = 48;
const DEFAULT_RATIO = 4 / 3;

/** **chữ** -> in đậm */
const RichText = ({ text }: { text: string }) => (
  <>
    {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') && part.length > 4
        ? <strong key={i} style={{ fontWeight: 800 }}>{part.slice(2, -2)}</strong>
        : <span key={i}>{part}</span>
    )}
  </>
);

/** Khung ảnh để sẵn: chưa có ảnh thì giữ chỗ (nét đứt), áp ảnh sau là vừa khung */
const ImageFrame = ({ url, grayscale, ratio }: { url?: string; grayscale: boolean; ratio: number }) => (
  <div className="float-right ml-[4mm] mb-[1.5mm]" style={{ width: `${IMG_W_MM}mm`, aspectRatio: String(ratio) }}>
    {url ? (
      <img
        src={url}
        alt=""
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '1mm', filter: grayscale ? 'grayscale(1) contrast(1.05)' : undefined }}
      />
    ) : (
      <div
        className="flex items-center justify-center"
        style={{ width: '100%', height: '100%', border: '0.75pt dashed #9ca3af', borderRadius: '1mm', background: '#f8fafc', color: '#9ca3af', fontSize: '8pt' }}
      >
        Ảnh
      </div>
    )}
  </div>
);

/** Bài đọc có ảnh bên phải từng khối; bên dưới là các câu cần nối, cột ô trả lời và khung lựa chọn A, B... */
export const ReadingImagesLayout = ({ data }: LayoutProps) => {
  const st = useLayoutStyle(data);
  const blocks = data.reading || [];
  return (
    <div className="w-full" style={{ fontSize: st.fontSize, lineHeight: 1.45, fontFamily: st.fontFamily }}>
      {data.readingHeading && <div className="text-center font-extrabold uppercase mb-[2.5mm]">{data.readingHeading}</div>}
      {data.readingIntro && (
        <div className="italic mb-[3mm]">
          {data.readingIntro.split('\n').filter(Boolean).map((l, i) => <p key={i} className="mb-[1.5mm]"><RichText text={l} /></p>)}
        </div>
      )}

      {blocks.map((b) => (
        <div key={b.id} className="flow-root mb-[3mm]">
          {(b.name || b.location) && (
            <div className="grid mb-[1.5mm]" style={{ gridTemplateColumns: '55% 1fr' }}>
              <div><strong style={{ fontWeight: 800 }}>Name: </strong><strong style={{ fontWeight: 800, color: '#c81e1e' }}>{b.name}</strong></div>
              <div><strong style={{ fontWeight: 800 }}>Location: </strong>{b.location}</div>
            </div>
          )}
          {b.title && <div className="mb-[1.5mm]"><RichText text={b.title} /></div>}
          <ImageFrame url={b.imageUrl} grayscale={data.settings.grayscale} ratio={b.imageRatio || DEFAULT_RATIO} />
          {b.text.split(/\n\s*\n/).filter((p) => p.trim()).map((para, i) => (
            <p key={i} className="mb-[2mm] text-justify"><RichText text={para.trim()} /></p>
          ))}
        </div>
      ))}

      <div className="flex items-start gap-[5mm] mt-[4mm]">
        <ol className="flex-1 min-w-0" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {data.problems.map((p, i) => (
            <li key={p.id} className="flex items-center gap-[2mm]" style={{ ...keepTogether, minHeight: '7.6mm' }}>
              {data.settings.showNumbering && <span className="font-extrabold min-w-[6mm]">{i + 1}.</span>}
              <span className="flex-1">{p.text}</span>
              {data.settings.showAnswerBoxes && <AnswerBox size={7.5} />}
            </li>
          ))}
        </ol>
        <div className="shrink-0 self-start" style={{ width: '50mm', border: '0.75pt solid #444', borderRadius: '2mm', padding: '2mm 3mm', ...keepTogether }}>
          {data.solutions.map((s, i) => (
            <div key={s.id} className="flex items-start gap-[3mm]" style={{ marginBottom: '1.2mm' }}>
              <span className="font-extrabold min-w-[5mm]">{solutionLabel(i).toUpperCase()}.</span>
              <span>{s.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
