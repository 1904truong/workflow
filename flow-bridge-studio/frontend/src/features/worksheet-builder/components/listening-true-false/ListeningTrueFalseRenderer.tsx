import React from 'react';
import { Headphones } from 'lucide-react';
import type { ListeningTrueFalseData, TfStyleKey } from '../../services/listening-true-false/listeningTrueFalseCore';
import { textStyleToCss } from '../../services/matching-pictures/matchingPicturesCore';
import { getAudioQrCodeUrl } from '../../services/listening/listeningGapFillCore';

const NAVY = '#16295f';
const RED = '#c81e1e';
const HEAD_FONT = '"Roboto Condensed", "Arial Narrow", Arial, sans-serif';
const IMG_W_MM = 52;
const DEFAULT_RATIO = 4 / 3;

export interface TfEditable {
  onTitle?: (v: string) => void;
  onInstruction?: (v: string) => void;
  onStatement?: (id: string, v: string) => void;
  selectedKey?: TfStyleKey;
  onSelectKey?: (k: TfStyleKey) => void;
}

interface Props {
  data: ListeningTrueFalseData;
  exerciseIndex?: number;
  hideExerciseHeading?: boolean;
  /** Có giá trị: chữ sửa trực tiếp được trên trang (Edit Mode) */
  editable?: TfEditable;
}

/** [[chữ]] -> đỏ đậm (TRUE (T) / FALSE (F)); **chữ** -> đậm */
const RichText = ({ text }: { text: string }) => (
  <>
    {text.split(/(\[\[[^\]]+\]\]|\*\*[^*]+\*\*)/g).map((part, i) => {
      if (part.startsWith('[[') && part.endsWith(']]')) return <span key={i} style={{ color: RED }}>{part.slice(2, -2)}</span>;
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
      return <span key={i}>{part}</span>;
    })}
  </>
);

/** Chữ sửa trực tiếp như Word: bấm là có con trỏ; bấm ra ngoài hoặc Enter để lưu, Esc để hủy */
const EditableText: React.FC<{
  value: string;
  onCommit?: (v: string) => void;
  css?: React.CSSProperties;
  selected?: boolean;
  onSelect?: () => void;
  /** Hiển thị có tô màu khi không sửa */
  rich?: boolean;
}> = ({ value, onCommit, css, selected, onSelect, rich }) => {
  if (!onCommit) return <span style={css}>{rich ? <RichText text={value} /> : value}</span>;
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      className="rounded-[2px] cursor-text caret-blue-600 hover:bg-blue-50 focus:bg-blue-50/60 focus:outline focus:outline-1 focus:outline-blue-400 focus:outline-offset-2"
      style={{ ...css, display: 'inline-block', minWidth: '3ch', outline: selected ? '1px solid #8b5cf6' : undefined, outlineOffset: '2px' }}
      onFocus={onSelect}
      onClick={onSelect}
      onBlur={(e) => {
        const v = e.currentTarget.innerText.replace(/ /g, ' ').replace(/\s*\n+\s*/g, ' ').trim();
        if (v !== value) onCommit(v);
        else e.currentTarget.innerText = value;
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === 'Escape') { e.currentTarget.innerText = value; e.currentTarget.blur(); }
      }}
    >
      {value}
    </span>
  );
};

export const ListeningTrueFalseRenderer: React.FC<Props> = ({ data, exerciseIndex = 1, hideExerciseHeading = false, editable }) => {
  const { settings, statements, audio, image } = data;
  const css = (k: TfStyleKey) => textStyleToCss(data.textStyles?.[k]) as React.CSSProperties;
  const sel = (k: TfStyleKey) => editable?.selectedKey === k;
  const pick = (k: TfStyleKey) => (editable?.onSelectKey ? () => editable.onSelectKey!(k) : undefined);
  const ratio = image.ratio || DEFAULT_RATIO;
  const showPicture = settings.showImage;
  const showQr = settings.showQrCode;
  const qrUrl = audio.shareUrl ? getAudioQrCodeUrl(audio.shareUrl) : '';

  const qrBox = (sizeMm: number) =>
    qrUrl ? (
      <img src={qrUrl} alt="Audio QR" style={{ width: `${sizeMm}mm`, height: `${sizeMm}mm`, background: '#fff', padding: '0.8mm', border: '0.75pt solid #cbd5e1', borderRadius: '1mm' }} />
    ) : (
      <div style={{ width: `${sizeMm}mm`, height: `${sizeMm}mm`, background: '#fff', border: '0.75pt dashed #94a3b8', borderRadius: '1mm', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5.5pt', color: '#94a3b8', textAlign: 'center', padding: '0.8mm' }}>
        QR audio
      </div>
    );

  const picture =
    showPicture || showQr ? (
      <div className="shrink-0 relative" style={{ width: `${showPicture ? IMG_W_MM : 22}mm`, ...(showPicture ? { aspectRatio: String(ratio) } : {}) }}>
        {showPicture && (
          image.url ? (
            <img src={image.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '2mm', display: 'block' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', border: '0.75pt dashed #9ca3af', borderRadius: '2mm', background: '#f8fafc', color: '#9ca3af', fontSize: '8pt', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              Ảnh
            </div>
          )
        )}
        {showQr && (
          <div className={showPicture ? 'absolute' : ''} style={showPicture ? { top: '1.2mm', right: '1.2mm' } : {}}>{qrBox(showPicture ? 15 : 20)}</div>
        )}
      </div>
    ) : null;

  return (
    <div style={{ fontFamily: `${settings.fontFamily || 'Arial'}, sans-serif`, fontSize: `${settings.fontSizePt}pt`, lineHeight: settings.lineHeight, color: '#111' }}>
      {!hideExerciseHeading && settings.showExerciseTitle && (
        <div className="flex items-start justify-between gap-[5mm] mb-[6mm]">
          <div className="flex items-start gap-[3mm] min-w-0 flex-1">
            <span
              style={{ width: '5.6mm', height: '5.6mm', background: NAVY, color: '#fff', borderRadius: '1mm', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11pt', fontFamily: HEAD_FONT, lineHeight: 1, flexShrink: 0, marginTop: '0.5mm' }}
            >
              {data.exerciseNumber || exerciseIndex}
            </span>
            {settings.showAudioIcon && <Headphones size={18} strokeWidth={2.5} style={{ color: NAVY, marginTop: '0.6mm', flexShrink: 0 }} />}
            <div className="min-w-0">
              <h2 style={{ margin: 0, color: NAVY, fontFamily: HEAD_FONT, fontWeight: 800, fontSize: `${settings.headingFontSizePt}pt`, textTransform: 'uppercase', lineHeight: 1.3, ...css('title') }}>
                <EditableText value={data.exerciseTitle} onCommit={editable?.onTitle} selected={sel('title')} onSelect={pick('title')} rich />
              </h2>
              {data.instruction && (
                <p className="italic mt-[1.5mm]" style={{ fontSize: '10pt', ...css('instruction') }}>
                  <EditableText value={data.instruction} onCommit={editable?.onInstruction} selected={sel('instruction')} onSelect={pick('instruction')} />
                </p>
              )}
            </div>
          </div>
          {picture}
        </div>
      )}
      {hideExerciseHeading && picture && <div className="flex justify-end mb-[4mm]">{picture}</div>}

      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {statements.map((s, i) => (
          <li key={s.id} className="flex items-end gap-[3mm]" style={{ breakInside: 'avoid', marginBottom: `${settings.rowGapMm}mm` }}>
            {settings.showNumbering && <strong style={{ minWidth: '6mm', fontWeight: 800 }}>{i + 1}.</strong>}
            <span className="flex-1" style={css('statements')}>
              <EditableText value={s.text} onCommit={editable?.onStatement ? (v) => editable.onStatement!(s.id, v) : undefined} css={css('statements')} selected={sel('statements')} onSelect={pick('statements')} />
            </span>
            {settings.showAnswerLine && (
              <span className="shrink-0" style={{ width: `${settings.answerLineWidthMm}mm`, borderBottom: '1pt dashed #444', height: '1.1em' }} />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
};
