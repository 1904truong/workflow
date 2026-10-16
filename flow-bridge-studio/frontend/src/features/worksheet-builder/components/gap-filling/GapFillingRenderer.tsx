import React from 'react';
import type { GapFillingData, GapStyleKey } from '../../services/gap-filling/gapFillingCore';
import { passageParagraphs, passageSentences, splitPassage } from '../../services/gap-filling/gapFillingCore';
import { textStyleToCss } from '../../services/matching-pictures/matchingPicturesCore';
import { getAudioQrCodeUrl } from '../../services/listening/listeningGapFillCore';

const NAVY = '#16295f';
const BLUE = '#1d4ed8';
const HEAD_FONT = '"Roboto Condensed", "Arial Narrow", Arial, sans-serif';

export interface GapEditable {
  onTitle?: (v: string) => void;
  onInstruction?: (v: string) => void;
  onWord?: (id: string, v: string) => void;
  selectedKey?: GapStyleKey;
  onSelectKey?: (k: GapStyleKey) => void;
}

interface Props {
  data: GapFillingData;
  exerciseIndex?: number;
  hideExerciseHeading?: boolean;
  /** Có giá trị: tiêu đề, hướng dẫn và các từ trong khung sửa trực tiếp được trên trang (Edit Mode) */
  editable?: GapEditable;
}

/** Chữ sửa trực tiếp như Word: bấm là có con trỏ; bấm ra ngoài hoặc Enter để lưu, Esc để hủy */
const EditableText: React.FC<{
  value: string;
  onCommit?: (v: string) => void;
  css?: React.CSSProperties;
  selected?: boolean;
  onSelect?: () => void;
}> = ({ value, onCommit, css, selected, onSelect }) => {
  if (!onCommit) return <span style={css}>{value}</span>;
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

export const GapFillingRenderer: React.FC<Props> = ({ data, exerciseIndex = 1, hideExerciseHeading = false, editable }) => {
  const { settings, words, audio } = data;
  const css = (k: GapStyleKey) => textStyleToCss(data.textStyles?.[k]) as React.CSSProperties;
  const sel = (k: GapStyleKey) => editable?.selectedKey === k;
  const pick = (k: GapStyleKey) => (editable?.onSelectKey ? () => editable.onSelectKey!(k) : undefined);
  const font = settings.fontFamily && settings.fontFamily !== 'Arial'
    ? `${settings.fontFamily}, "Segoe UI", Arial, sans-serif`
    : 'Arial, sans-serif';
  const qrUrl = audio.shareUrl ? getAudioQrCodeUrl(audio.shareUrl) : '';
  const qr = settings.showQrCode ? (
    qrUrl ? (
      <img src={qrUrl} alt="Audio QR" style={{ width: '17mm', height: '17mm', background: '#fff', padding: '0.8mm', border: '0.75pt solid #cbd5e1', borderRadius: '1mm' }} />
    ) : (
      <div style={{ width: '17mm', height: '17mm', background: '#fff', border: '0.75pt dashed #94a3b8', borderRadius: '1mm', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5.5pt', color: '#94a3b8', textAlign: 'center', padding: '0.8mm' }}>
        QR audio
      </div>
    )
  ) : null;

  const numbered = settings.layout === 'numbered_list';
  const paragraphs = numbered ? passageSentences(data.passage) : passageParagraphs(data.passage);
  const blankW = `${settings.blankWidthMm}mm`;

  return (
    <div style={{ fontFamily: font, fontSize: `${settings.fontSizePt}pt`, color: '#111' }}>
      {!hideExerciseHeading && settings.showExerciseTitle && (
        <div className="flex items-start justify-between gap-[5mm] mb-[4mm]">
          <div className="flex items-start gap-[3mm] min-w-0 flex-1">
            <span
              style={{ width: '5.6mm', height: '5.6mm', background: NAVY, color: '#fff', borderRadius: '1mm', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11pt', fontFamily: HEAD_FONT, lineHeight: 1, flexShrink: 0, marginTop: '0.5mm' }}
            >
              {data.exerciseNumber || exerciseIndex}
            </span>
            <div className="min-w-0">
              <h2 style={{ margin: 0, color: BLUE, fontFamily: HEAD_FONT, fontWeight: 800, fontSize: `${settings.headingFontSizePt}pt`, textTransform: 'uppercase', lineHeight: 1.3, ...css('title') }}>
                <EditableText value={data.exerciseTitle} onCommit={editable?.onTitle} selected={sel('title')} onSelect={pick('title')} />
              </h2>
              {settings.showInstruction && data.instruction && (
                <p className="italic mt-[1.5mm]" style={{ fontSize: '10pt', ...css('instruction') }}>
                  <EditableText value={data.instruction} onCommit={editable?.onInstruction} selected={sel('instruction')} onSelect={pick('instruction')} />
                </p>
              )}
            </div>
          </div>
          {qr}
        </div>
      )}
      {hideExerciseHeading && qr && <div className="flex justify-end mb-[3mm]">{qr}</div>}

      {settings.showWordBank && words.length > 0 && (
        <div
          style={numbered
            ? { margin: '0 auto 6mm', width: '78%', border: '1pt solid #111', borderRadius: '3mm', padding: '2.5mm 6mm', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', columnGap: '6mm', rowGap: '2mm', textAlign: 'center', fontWeight: 700, ...css('wordBank') }
            : { margin: '0 auto 6mm', width: 'fit-content', maxWidth: '100%', border: '1pt solid #111', borderRadius: '2.5mm', padding: '2mm 7mm', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '9mm', rowGap: '1mm', fontWeight: 700, ...css('wordBank') }}
        >
          {words.map((w) => (
            <span key={w.id}>
              <EditableText value={w.text} onCommit={editable?.onWord ? (v) => editable.onWord!(w.id, v) : undefined} css={css('wordBank')} selected={sel('wordBank')} onSelect={pick('wordBank')} />
            </span>
          ))}
        </div>
      )}

      <div style={{ lineHeight: numbered ? 1.9 : settings.lineHeight, ...css('passage') }}>
        {paragraphs.map((p, pi) => (
          <p
            key={pi}
            className={numbered ? 'flex items-baseline gap-[3mm]' : undefined}
            style={numbered ? { margin: '0 0 2.2mm', breakInside: 'avoid' } : { margin: '0 0 2mm', textAlign: 'justify', textIndent: '8mm' }}
            onClick={pick('passage')}
          >
            {numbered && <strong style={{ minWidth: '6mm', fontWeight: 800 }}>{pi + 1}.</strong>}
            <span className={numbered ? 'flex-1' : undefined}>
              {splitPassage(p).map((part, i) =>
                part.kind === 'text' ? (
                  <span key={i}>{part.text}</span>
                ) : (
                  <span key={i} style={{ whiteSpace: 'nowrap' }}>
                    {part.label && <strong style={{ fontWeight: 800 }}>({part.label}) </strong>}
                    <span style={{ display: 'inline-block', width: blankW, borderBottom: '1pt dashed #1e293b', verticalAlign: 'baseline', height: '1em' }} />
                  </span>
                ),
              )}
            </span>
          </p>
        ))}
      </div>
    </div>
  );
};
