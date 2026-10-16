import type { CefrLevel, WorksheetBranding } from '../../types/branding';

const NAVY = '#16295f';
const BODY = 'Quicksand, "Segoe UI", Arial, sans-serif';
const HEAD_FONT = '"Roboto Condensed", "Arial Narrow", Arial, sans-serif';
const CEFR: { id: CefrLevel; color: string }[] = [
  { id: 'A1', color: '#1d4ed8' },
  { id: 'A2', color: '#15803d' },
  { id: 'B1', color: '#c81e1e' },
  { id: 'B2', color: '#6b1d3a' },
];

const Pin = () => (
  <svg width="13" height="17" viewBox="0 0 24 32" aria-hidden="true">
    <path d="M12 1C6.5 1 2 5.3 2 10.7 2 18 12 31 12 31s10-13 10-20.3C22 5.3 17.5 1 12 1z" fill="none" stroke="#c81e1e" strokeWidth="3" />
    <circle cx="12" cy="11" r="3.6" fill="#c81e1e" />
  </svg>
);

const Sticker = ({ text, color, rotate }: { text: string; color: string; rotate: number }) => (
  <div className="flex flex-col items-center" style={{ transform: `rotate(${rotate}deg)` }}>
    <span
      className="px-[1mm] text-[10pt] font-black italic leading-none"
      style={{ color, WebkitTextStroke: '0.6px #111', fontFamily: HEAD_FONT, background: '#fff', border: `1.5px solid ${color}`, borderRadius: 3 }}
    >
      {text}
    </span>
    <span className="mt-[1px] block w-[2.6mm] h-[2.6mm] border border-[#666]" />
  </div>
);

export const Logo = ({ url }: { url?: string }) =>
  url ? (
    <img src={url} alt="Logo" className="h-full w-full object-contain" />
  ) : (
    <div className="h-full w-full flex items-center justify-center border border-dashed border-[#9aa4c0] text-[8pt] text-[#9aa4c0] text-center leading-tight rounded-sm">
      LOGO
    </div>
  );

interface Props {
  b: WorksheetBranding;
  onEdit?: () => void;
}

export const BrandHeader = ({ b, onEdit }: Props) => (
  <div
    className={`ws-brand-header w-full mb-[5mm] ${onEdit ? 'cursor-pointer hover:outline hover:outline-2 hover:outline-dashed hover:outline-violet-400 hover:outline-offset-2 rounded' : ''}`}
    onClick={onEdit}
    title={onEdit ? 'Bấm để chỉnh header/footer' : undefined}
    style={{ fontFamily: HEAD_FONT, color: NAVY }}
  >
    <div className="flex items-center gap-[2.5mm]" style={{ minHeight: '22mm' }}>
      <div style={{ width: '21mm', height: '20mm' }} className="shrink-0"><Logo url={b.logoUrl} /></div>

      <div className="shrink-0">
        <div className="text-[17pt] font-extrabold leading-none tracking-wide uppercase">{b.docTitle}</div>
        <div className="mt-[2mm] text-[9pt] leading-snug text-[#333] font-semibold" style={{ fontFamily: BODY }}>
          Level <span className="ml-[3mm]">{b.level}</span>
          <br />
          No. <span className="ml-[3.5mm] font-bold text-[#c81e1e]" style={{ fontFamily: HEAD_FONT }}>{b.worksheetNo}</span>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col items-center justify-end self-stretch pb-[1mm]">
        <div className="flex gap-[0.8mm]" style={{ fontFamily: BODY }}>
          {CEFR.map((c) => (
            <div key={c.id} className="flex flex-col items-center" style={{ width: '9.5mm' }}>
              <div style={{ height: '5mm', visibility: c.id === b.cefrActive ? 'visible' : 'hidden' }}><Pin /></div>
              <div className="w-full text-center text-white text-[7pt] font-bold rounded-full" style={{ background: c.color, height: '4.2mm', lineHeight: '4.2mm' }}>{c.id}</div>
            </div>
          ))}
        </div>
      </div>

      {b.showScoreBox && (
        <div className="shrink-0 border border-[#333] rounded-sm text-[8pt] font-semibold text-[#333] px-[1mm] pt-[0.5mm]" style={{ width: '15mm', height: '14mm', fontFamily: BODY }}>
          Score
        </div>
      )}
      {b.showStickers && (
        <div className="shrink-0 flex gap-[1mm] items-end">
          <Sticker text="OK" color="#e11d2e" rotate={-8} />
          <Sticker text="GOOD" color="#eab308" rotate={-3} />
          <Sticker text="WOW" color="#16a34a" rotate={5} />
        </div>
      )}
    </div>

    <div className="flex items-baseline gap-[3mm] pt-[1.5mm] pb-[1mm] text-[11pt] font-semibold" style={{ borderBottom: '0.75pt solid #9aa4c0', color: '#222', fontFamily: BODY }}>
      <span>Name</span><span className="flex-1 text-center tracking-[0.15em] text-[#777]">_________</span>
      <span>Date</span><span className="flex-1 text-center tracking-[0.15em] text-[#777]">___/___/___</span>
      <span>Parent</span><span className="flex-1 text-center tracking-[0.15em] text-[#777]">_________</span>
    </div>
  </div>
);
