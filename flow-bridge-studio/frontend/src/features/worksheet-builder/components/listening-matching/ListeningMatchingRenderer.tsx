import React from 'react';
import { Headphones } from 'lucide-react';
import type { ListeningMatchingData, LmStyleKey } from '../../services/listening-matching/listeningMatchingCore';
import { optionLabel } from '../../services/listening-matching/listeningMatchingCore';
import { textStyleToCss } from '../../services/matching-pictures/matchingPicturesCore';
import { getAudioQrCodeUrl } from '../../services/listening/listeningGapFillCore';

const NAVY = '#16295f';
const RED = '#c81e1e';
const HEAD_FONT = '"Roboto Condensed", "Arial Narrow", Arial, sans-serif';

export interface LmEditable {
  onTitle?: (v: string) => void;
  onInstruction?: (v: string) => void;
  onProblem?: (id: string, v: string) => void;
  onOption?: (id: string, v: string) => void;
  selectedKey?: LmStyleKey;
  onSelectKey?: (k: LmStyleKey) => void;
}

interface Props {
  data: ListeningMatchingData;
  exerciseIndex?: number;
  hideExerciseHeading?: boolean;
  /** Có giá trị: chữ sửa trực tiếp được trên trang (Edit Mode) */
  editable?: LmEditable;
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

export const ListeningMatchingRenderer: React.FC<Props> = ({ data, exerciseIndex = 1, hideExerciseHeading = false, editable }) => {
  const { settings, problems, options, audio } = data;
  const css = (k: LmStyleKey) => textStyleToCss(data.textStyles?.[k]) as React.CSSProperties;
  const sel = (k: LmStyleKey) => editable?.selectedKey === k;
  const pick = (k: LmStyleKey) => (editable?.onSelectKey ? () => editable.onSelectKey!(k) : undefined);
  const qrUrl = audio.shareUrl ? getAudioQrCodeUrl(audio.shareUrl) : '';

  const qrBox = (sizeMm: number) =>
    qrUrl ? (
      <img src={qrUrl} alt="Audio QR" style={{ width: `${sizeMm}mm`, height: `${sizeMm}mm`, background: '#fff', padding: '0.8mm', border: '0.75pt solid #cbd5e1', borderRadius: '1mm' }} />
    ) : (
      <div style={{ width: `${sizeMm}mm`, height: `${sizeMm}mm`, background: '#fff', border: '0.75pt dashed #94a3b8', borderRadius: '1mm', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5.5pt', color: '#94a3b8', textAlign: 'center', padding: '0.8mm' }}>
        QR audio
      </div>
    );

  const itemRow = (label: string, id: string, text: string, key: LmStyleKey, onCommit?: (id: string, v: string) => void) => (
    <li key={id} className="flex items-start gap-[3mm]" style={{ breakInside: 'avoid', marginBottom: `${settings.rowGapMm}mm` }}>
      <strong style={{ minWidth: '6mm', fontWeight: 800 }}>{label}</strong>
      <span className="flex-1" style={css(key)}>
        <EditableText value={text} onCommit={onCommit ? (v) => onCommit(id, v) : undefined} css={css(key)} selected={sel(key)} onSelect={pick(key)} />
      </span>
    </li>
  );

  return (
    <div style={{ fontFamily: `${settings.fontFamily || 'Arial'}, sans-serif`, fontSize: `${settings.fontSizePt}pt`, lineHeight: settings.lineHeight, color: '#111' }}>
      {!hideExerciseHeading && settings.showExerciseTitle && (
        <div className="flex items-start justify-between gap-[5mm] mb-[5mm]">
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
                <p className={settings.layout === 'columns_boxes' ? 'mt-[1.5mm]' : 'italic mt-[1.5mm]'} style={{ fontSize: '10pt', ...css('instruction') }}>
                  <EditableText value={data.instruction} onCommit={editable?.onInstruction} selected={sel('instruction')} onSelect={pick('instruction')} />
                </p>
              )}
            </div>
          </div>
          {settings.showQrCode && <div className="shrink-0">{qrBox(18)}</div>}
        </div>
      )}
      {(hideExerciseHeading || !settings.showExerciseTitle) && settings.showQrCode && <div className="flex justify-end mb-[3mm]">{qrBox(18)}</div>}

      {settings.layout === 'columns_boxes' ? (
        <div className="grid items-start" style={{ gridTemplateColumns: '1fr 1fr', columnGap: '10mm' }}>
          <div>
            {data.problemsHeading && <div style={{ fontFamily: HEAD_FONT, fontWeight: 800, textTransform: 'uppercase', marginBottom: '2mm' }}>{data.problemsHeading}</div>}
            {problems.map((s, i) => (
              <div key={s.id} className="flex items-center gap-[3mm]" style={{ breakInside: 'avoid', marginBottom: `${settings.rowGapMm}mm` }}>
                {settings.showNumbering && <strong style={{ minWidth: '6mm', fontWeight: 800 }}>{i + 1}.</strong>}
                <span className="flex-1" style={css('problems')}>
                  <EditableText value={s.text} onCommit={editable?.onProblem ? (v) => editable.onProblem!(s.id, v) : undefined} css={css('problems')} selected={sel('problems')} onSelect={pick('problems')} />
                </span>
                {settings.showAnswerBox && <span className="shrink-0" style={{ width: '9mm', height: '7.5mm', border: '0.75pt solid #444', borderRadius: '1.2mm' }} />}
              </div>
            ))}
          </div>
          <div>
            {data.optionsHeading && <div style={{ fontFamily: HEAD_FONT, fontWeight: 800, textTransform: 'uppercase', marginBottom: '2mm' }}>{data.optionsHeading}</div>}
            {options.map((s, i) => (
              <div key={s.id} className="flex items-start gap-[4mm]" style={{ breakInside: 'avoid', marginBottom: `${settings.rowGapMm}mm` }}>
                <strong style={{ minWidth: '5mm', fontWeight: 800 }}>{optionLabel(i, true)}</strong>
                <span className="flex-1" style={css('options')}>
                  <EditableText value={s.text} onCommit={editable?.onOption ? (v) => editable.onOption!(s.id, v) : undefined} css={css('options')} selected={sel('options')} onSelect={pick('options')} />
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
      <div className="flex items-start gap-[8mm]">
        <div className="flex-1 min-w-0">
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {problems.map((s, i) => itemRow(settings.showNumbering ? `${i + 1}.` : '', s.id, s.text, 'problems', editable?.onProblem))}
          </ol>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, marginTop: '2mm' }}>
            {options.map((s, i) => itemRow(`${optionLabel(i)}.`, s.id, s.text, 'options', editable?.onOption))}
          </ol>
        </div>
        {settings.showAnswerBox && (
          <div className="shrink-0" style={{ width: `${settings.answerBoxWidthMm}mm`, border: '0.75pt solid #3b82f6', borderRadius: '2mm', padding: '2mm 3mm', marginTop: '1mm' }}>
            {problems.map((s, i) => (
              <div key={s.id} className="flex items-end gap-[1.5mm]" style={{ breakInside: 'avoid', marginBottom: '1.2mm' }}>
                <span className="font-bold">{i + 1}.</span>
                <span className="flex-1" style={{ borderBottom: '0.75pt dashed #444', height: '1.15em' }} />
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
};
