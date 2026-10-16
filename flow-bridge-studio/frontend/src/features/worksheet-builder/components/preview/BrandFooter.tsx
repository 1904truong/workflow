import type { WorksheetBranding } from '../../types/branding';
import { progressFor } from '../../types/branding';

const NAVY = '#16295f';
const BODY = 'Quicksand, "Segoe UI", Arial, sans-serif';
const HEAD_FONT = '"Roboto Condensed", "Arial Narrow", Arial, sans-serif';

const Globe = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.6" aria-hidden="true">
    <circle cx="12" cy="12" r="9.5" />
    <path d="M2.5 12h19M12 2.5c3 3 3 16 0 19M12 2.5c-3 3-3 16 0 19" />
  </svg>
);

const Book = () => (
  <svg width="12" height="13" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.8" aria-hidden="true">
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M9 3v8l3-2 3 2V3" />
  </svg>
);

const PageBadge = ({ n }: { n: number }) => (
  <div className="shrink-0 relative flex flex-col items-center rounded-[1.4mm] overflow-hidden border border-[#d9dde8] bg-white" style={{ width: '15mm', fontFamily: HEAD_FONT, boxShadow: '0 1px 3px rgba(22,41,95,.25)' }}>
    <div className="w-full text-center text-[6.5pt] font-bold tracking-widest" style={{ color: NAVY, lineHeight: '4mm', borderTop: '1.2mm solid ' + NAVY }}>PAGE</div>
    <div className="w-full text-center text-[24pt] font-extrabold" style={{ color: NAVY, lineHeight: '9.5mm' }}>{n}</div>
  </div>
);

const WebsiteHint = () => (
  <span className="inline-flex items-center gap-[0.8mm] shrink-0 text-[7pt] font-bold text-[#333]" style={{ fontFamily: HEAD_FONT }}>
    <svg width="14" height="12" viewBox="0 0 28 22" fill="none" stroke="#333" strokeWidth="1.6" aria-hidden="true">
      <path d="M26 20C14 20 6 16 5 6M5 6l-4 5M5 6l6 3" />
    </svg>
    Website
  </span>
);

const Avatar = ({ url }: { url?: string }) =>
  url ? (
    <img src={url} alt="" className="rounded-full object-cover" style={{ width: '17mm', height: '17mm', border: `2px solid ${NAVY}` }} />
  ) : (
    <div className="rounded-full border border-dashed border-[#9aa4c0] flex items-center justify-center text-[8pt] text-[#9aa4c0] text-center leading-tight" style={{ width: '17mm', height: '17mm' }}>
      ẢNH
    </div>
  );

const Qr = ({ url }: { url?: string }) =>
  url ? (
    <img src={url} alt="QR" style={{ width: '17mm', height: '17mm' }} className="object-contain" />
  ) : (
    <div className="border border-dashed border-[#9aa4c0] flex items-center justify-center text-[9pt] text-[#9aa4c0]" style={{ width: '17mm', height: '17mm' }}>QR</div>
  );

const BLUE = '#0b2fa3';

/** Thanh tiến độ: nhãn % phía trên + thanh sọc chéo dài theo %, nối liền với đường kẻ ngang */
const ProgressLine = ({ value }: { value: string }) => {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  const barWidth = Math.min(100, 2.2 + 1.08 * pct);
  return (
    <div className="flex items-center" style={{ paddingTop: '3mm', position: 'relative' }}>
      <div className="relative shrink-0" style={{ width: `${barWidth}%`, height: '1.3mm', minWidth: '7mm' }}>
        <span
          className="absolute left-0 right-0 text-center font-bold leading-none"
          style={{ bottom: '100%', marginBottom: '0.6mm', color: BLUE, fontFamily: HEAD_FONT, fontSize: '9pt' }}
        >
          {value}<span style={{ fontSize: '6.5pt' }}>%</span>
        </span>
        <span
          className="block w-full h-full"
          style={{
            background: `repeating-linear-gradient(135deg, ${BLUE} 0 0.55mm, #fff 0.55mm 1.1mm)`,
            clipPath: 'polygon(0.5mm 0, 100% 0, calc(100% - 0.5mm) 100%, 0 100%)',
          }}
        />
      </div>
      <span className="flex-1 block" style={{ borderTop: `1pt solid ${BLUE}` }} />
    </div>
  );
};

interface Props {
  b: WorksheetBranding;
  pageNumber: number;
  totalPages: number;
  onEdit?: () => void;
}

export const BrandFooter = ({ b, pageNumber, totalPages, onEdit }: Props) => {
  const teacher = b.footerMode === 'teacher' || (b.footerMode === 'alternate' && pageNumber % 2 === 0);
  return (
    <div
      className={`ws-brand-footer w-full mt-auto pt-[2mm] flex items-center gap-[3mm] ${onEdit ? 'cursor-pointer hover:outline hover:outline-2 hover:outline-dashed hover:outline-violet-400 hover:outline-offset-2 rounded' : ''}`}
      onClick={onEdit}
      title={onEdit ? 'Bấm để chỉnh header/footer' : undefined}
      style={{ fontFamily: BODY }}
    >
      {teacher ? <Avatar url={b.avatarUrl} /> : <Qr url={b.qrUrl} />}

      <div className="flex-1 min-w-0">
        {/* Hàng trên: nhãn % + thanh sọc + đường kẻ tới huy hiệu trang */}
        <ProgressLine value={progressFor(b, pageNumber, totalPages)} />
        {/* Hàng dưới: giáo viên / website + Unit, Lesson */}
        <div className="flex items-center justify-between gap-[3mm] mt-[1.5mm] text-[10.5pt] text-[#333]">
          {teacher ? (
            <div className="flex items-center gap-[8mm]">
              <span><i className="text-[9pt]">Teacher</i> <b style={{ fontFamily: HEAD_FONT, color: NAVY }}>{b.teacherName}</b></span>
              <span className="font-bold text-[#c81e1e]" style={{ fontFamily: HEAD_FONT }}>{b.teacherPhone}</span>
            </div>
          ) : (
            <div className="flex items-center gap-[2.5mm]">
              <WebsiteHint />
              <span className="flex items-center gap-[1.5mm] font-semibold"><Globe />{b.website}</span>
            </div>
          )}
          <div className="flex items-center gap-[5mm] font-semibold">
            <span className="flex items-center gap-[1.5mm]"><Book />{b.unitLabel}</span>
            <span>{b.lessonLabel}</span>
          </div>
        </div>
      </div>

      <PageBadge n={pageNumber} />
    </div>
  );
};
