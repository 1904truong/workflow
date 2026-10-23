import React from 'react';
import type { SentenceCompletionData, SentenceItem, SentenceStyleKey } from '../../services/sentence-completion/sentenceCompletionCore';
import { splitTitleByTarget } from '../../services/sentence-completion/sentenceCompletionCore';
import { splitPassage } from '../../services/gap-filling/gapFillingCore';
import { textStyleToCss } from '../../services/matching-pictures/matchingPicturesCore';
import { getAudioQrCodeUrl } from '../../services/listening/listeningGapFillCore';
import { RichEditable } from '../shared/rich/RichEditable';

const NAVY = '#16295f';
const RED = '#c81e1e';
const ORANGE = '#f97316';
const HEAD_FONT = '"Roboto Condensed", "Arial Narrow", Arial, sans-serif';

export interface SentenceEditable {
  onTitle?: (v: string) => void;
  onInstruction?: (v: string) => void;
  onWord?: (id: string, v: string) => void;
  onSentence?: (id: string, v: string) => void;
  onHint?: (id: string, v: string) => void;
  onStarter?: (id: string, v: string) => void;
  onColumnHeader?: (index: 0 | 1, v: string) => void;
  selectedKey?: SentenceStyleKey;
  onSelectKey?: (k: SentenceStyleKey) => void;
}

interface Props {
  data: SentenceCompletionData;
  exerciseIndex?: number;
  hideExerciseHeading?: boolean;
  /** Có giá trị: chữ sửa trực tiếp được trên trang (Edit Mode) */
  editable?: SentenceEditable;
}

/** Chữ sửa trực tiếp như Word: bấm là có con trỏ; bấm ra ngoài hoặc Enter để lưu, Esc để hủy */
const EditableText: React.FC<{
  value: string;
  onCommit?: (v: string) => void;
  css?: React.CSSProperties;
  selected?: boolean;
  onSelect?: () => void;
  inline?: boolean;
  children?: React.ReactNode;
}> = ({ value, onCommit, css, selected, onSelect, inline, children }) => (
  <RichEditable value={value} onCommit={onCommit} css={css} selected={selected} onSelect={onSelect} display={inline ? 'inline' : 'inline-block'} fallback={children} />
);

export const SentenceCompletionRenderer: React.FC<Props> = ({ data, exerciseIndex = 1, hideExerciseHeading = false, editable }) => {
  const { settings, words, sentences, audio } = data;
  const css = (k: SentenceStyleKey) => textStyleToCss(data.textStyles?.[k]) as React.CSSProperties;
  const sel = (k: SentenceStyleKey) => editable?.selectedKey === k;
  const pick = (k: SentenceStyleKey) => (editable?.onSelectKey ? () => editable.onSelectKey!(k) : undefined);
  const font = settings.fontFamily && settings.fontFamily !== 'Arial'
    ? `${settings.fontFamily}, "Segoe UI", Arial, sans-serif`
    : 'Arial, sans-serif';
  const layout = settings.layout;
  const dialogueGapFill = layout === 'dialogue_gap_fill';
  const gap = `${dialogueGapFill ? Math.min(settings.rowGapMm, 2) : settings.rowGapMm}mm`;
  const blankW = `${dialogueGapFill ? Math.min(settings.blankWidthMm, 18) : settings.blankWidthMm}mm`;

  const qrUrl = audio.shareUrl ? getAudioQrCodeUrl(audio.shareUrl) : '';
  const qr = settings.showQrCode ? (
    qrUrl ? (
      <img src={qrUrl} alt="Audio QR" style={{ width: '17mm', height: '17mm', background: '#fff', padding: '0.8mm', border: '0.75pt solid #cbd5e1', borderRadius: '1mm' }} />
    ) : (
      <div style={{ width: '17mm', height: '17mm', background: '#fff', border: '0.75pt dashed #94a3b8', borderRadius: '1mm', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5.5pt', color: '#94a3b8', textAlign: 'center', padding: '0.8mm' }}>QR audio</div>
    )
  ) : null;

  const titleNode = (
    <>
      {splitTitleByTarget(data.exerciseTitle, data.targetWord).map((p, i) =>
        p.emphasis ? <em key={i} style={{ color: RED, fontWeight: 800, fontStyle: 'italic' }}>{p.text}</em> : <span key={i}>{p.text}</span>,
      )}
    </>
  );

  /** Câu có chỗ trống ______ -> dòng kẻ; câu ví dụ (Show Example) điền đáp án mẫu chữ đỏ gạch chân */
  const renderText = (s: SentenceItem, showBlankLabels = false) => {
    if (editable?.onSentence) {
      return <EditableText value={s.text} inline onCommit={(v) => editable.onSentence!(s.id, v)} css={css('sentences')} selected={sel('sentences')} onSelect={pick('sentences')} />;
    }
    let blankIdx = 0;
    return (
      <span style={css('sentences')} onClick={pick('sentences')}>
        {splitPassage(s.text).map((part, i) => {
          if (part.kind === 'text') return <span key={i}>{part.text}</span>;
          const showEx = settings.showExample && !!s.example && blankIdx === 0;
          blankIdx++;
          const blank = (
            <span style={{ display: 'inline-block', minWidth: blankW, borderBottom: `1pt ${showEx ? 'solid' : 'dashed'} ${showEx ? RED : '#1e293b'}`, textAlign: 'center', color: RED, fontWeight: 600, lineHeight: 1.1, verticalAlign: 'baseline', padding: '0 1mm' }}>
              {showEx ? s.example : ' '}
            </span>
          );
          return showBlankLabels && part.label ? (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.8mm', margin: '0 0.8mm' }}>
              <strong style={{ color: '#111', fontWeight: 700 }}>({part.label})</strong>{blank}
            </span>
          ) : <React.Fragment key={i}>{blank}</React.Fragment>;
        })}
      </span>
    );
  };

  const renderHint = (s: SentenceItem, extra?: React.CSSProperties) => {
    if (!s.hint) return null;
    return (
      <EditableText
        value={s.hint}
        onCommit={editable?.onHint ? (v) => editable.onHint!(s.id, v) : undefined}
        css={{ fontWeight: 700, fontStyle: 'italic', ...css('hints'), ...extra }}
        selected={sel('hints')}
        onSelect={pick('hints')}
      >
        ({s.hint})
      </EditableText>
    );
  };

  const num = (i: number) => settings.showNumbering && <strong style={{ minWidth: '7mm', fontWeight: 800 }}>{i + 1}.</strong>;

  const renderBody = () => {
    if (layout === 'dialogue_gap_fill') {
      return (
        <div style={{ margin: 0, padding: 0 }}>
          {sentences.map((s) => {
            const m = /^([A-Z][A-Za-z]{1,20}):\s*(.*)$/.exec(s.text);
            const name = m?.[1] || '';
            const rest = m ? m[2] : s.text;
            return (
              <div key={s.id} className="flex items-baseline" style={{ breakInside: 'avoid', marginBottom: gap }}>
                <strong style={{ flex: '0 0 14mm', color: '#111', fontWeight: 700 }}>{name ? `${name}:` : ''}</strong>
                <span className="min-w-0 flex-1" style={{ textAlign: 'left', ...css('sentences') }} onClick={pick('sentences')}>
                  {editable?.onSentence
                    ? <EditableText value={rest} inline onCommit={(v) => editable.onSentence!(s.id, name ? `${name}: ${v}` : v)} css={css('sentences')} selected={sel('sentences')} onSelect={pick('sentences')} />
                    : renderText({ ...s, text: rest }, true)}
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    if (layout === 'q_and_a') {
      return (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {sentences.map((s, i) => (
            <li key={s.id} className="flex items-baseline gap-[2mm]" style={{ breakInside: 'avoid', marginBottom: gap }}>
              {num(i)}
              <span style={{ flex: '0 0 27%' }}>
                <EditableText value={s.hint || ''} onCommit={editable?.onHint ? (v) => editable.onHint!(s.id, v) : undefined} css={css('hints')} selected={sel('hints')} onSelect={pick('hints')} />
              </span>
              <span style={{ flex: '0 0 40%' }}>{renderText(s)}</span>
              <span className="flex-1">{renderText({ ...s, text: s.starter || '' })}</span>
            </li>
          ))}
        </ol>
      );
    }
    if (layout === 'pos_neg') {
      const heads = data.columnHeaders || ['POSITIVE', 'NEGATIVE'];
      const hdr = (idx: 0 | 1) => (
        <div style={{ flex: '0 0 50%', color: '#e8803a', textTransform: 'uppercase', fontWeight: 500, paddingLeft: idx === 0 && settings.showNumbering ? '9mm' : 0, ...css('hints') }}>
          <EditableText value={heads[idx]} onCommit={editable?.onColumnHeader ? (v) => editable.onColumnHeader!(idx, v) : undefined} css={css('hints')} selected={sel('hints')} onSelect={pick('hints')} />
        </div>
      );
      return (
        <div>
          <div className="flex items-baseline gap-[2mm]" style={{ marginBottom: gap }}>{hdr(0)}{hdr(1)}</div>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {sentences.map((s, i) => (
              <li key={s.id} className="flex items-baseline gap-[2mm]" style={{ breakInside: 'avoid', marginBottom: gap }}>
                {num(i)}
                <span style={{ flex: '0 0 calc(50% - 9mm)' }}>
                  <EditableText value={s.text} inline onCommit={editable?.onSentence ? (v) => editable.onSentence!(s.id, v) : undefined} css={css('sentences')} selected={sel('sentences')} onSelect={pick('sentences')} />
                </span>
                <span className="flex-1">{renderText({ ...s, text: s.starter || '' })}</span>
              </li>
            ))}
          </ol>
        </div>
      );
    }
    if (layout === 'two_columns') {
      return (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, columnCount: 2, columnGap: '10mm' }}>
          {sentences.map((s, i) => (
            <li key={s.id} className="flex items-baseline gap-[2mm]" style={{ breakInside: 'avoid', marginBottom: gap }}>
              {num(i)}<span className="flex-1">{renderText(s)}</span>
            </li>
          ))}
        </ol>
      );
    }
    if (layout === 'dialogue_order') {
      const speakers: string[] = [];
      return (
        <div style={{ margin: 0, padding: 0 }}>
          {sentences.map((s) => {
            const m = /^([A-Z][A-Za-z]{1,14}):\s*(.*)$/.exec(s.text);
            const name = m?.[1];
            if (name && !speakers.includes(name)) speakers.push(name);
            const color = name ? (speakers.indexOf(name) % 2 === 0 ? RED : '#1d4ed8') : '#111';
            return (
              <div key={s.id} className="flex items-baseline gap-[2.5mm]" style={{ breakInside: 'avoid', marginBottom: gap }}>
                <span className="shrink-0" style={{ width: '13mm', borderBottom: '1pt dashed #1e293b', height: '1em' }} />
                {name && <strong style={{ color, minWidth: '11mm', fontWeight: 800 }}>{name}</strong>}
                <span className="flex-1" style={{ textAlign: 'justify', ...css('sentences') }} onClick={pick('sentences')}>
                  <EditableText value={m ? m[2] : s.text} onCommit={editable?.onSentence ? (v) => editable.onSentence!(s.id, name ? `${name}: ${v}` : v) : undefined} css={css('sentences')} selected={sel('sentences')} onSelect={pick('sentences')} />
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    if (layout === 'rewrite') {
      return (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {sentences.map((s, i) => (
            <li key={s.id} style={{ breakInside: 'avoid', marginBottom: gap }}>
              <div className="flex items-baseline gap-[2mm]">
                {num(i)}<span className="flex-1">{renderText(s)}</span>
              </div>
              <div className="flex items-end gap-[1.5mm]" style={{ marginLeft: settings.showNumbering ? '9mm' : 0, marginTop: '1.5mm' }}>
                {(s.starter || editable?.onStarter) && (
                  <EditableText value={s.starter || ''} onCommit={editable?.onStarter ? (v) => editable.onStarter!(s.id, v) : undefined} css={{ whiteSpace: 'nowrap', ...css('sentences') }} selected={sel('sentences')} onSelect={pick('sentences')} />
                )}
                <span className="flex-1" style={{ borderBottom: '1pt dashed #1e293b', minHeight: '1em', marginBottom: '0.6mm' }} />
              </div>
            </li>
          ))}
        </ol>
      );
    }
    if (layout === 'error_correction') {
      return (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {sentences.map((s, i) => (
            <li key={s.id} className="flex items-end gap-[2mm]" style={{ breakInside: 'avoid', marginBottom: gap }}>
              {num(i)}
              <span style={{ flex: '0 0 56%' }}>{renderText(s)}</span>
              <span className="flex-1" style={{ borderBottom: '1pt dashed #1e293b', minHeight: '1em', marginBottom: '0.6mm' }} />
            </li>
          ))}
        </ol>
      );
    }
    if (layout === 'transform') {
      return (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {sentences.map((s, i) => (
            <li key={s.id} className="flex items-baseline gap-[2mm]" style={{ breakInside: 'avoid', marginBottom: gap }}>
              {num(i)}
              <span style={{ flex: '0 0 50%' }}>{s.hint ? <span style={css('hints')}>(<EditableText value={s.hint} onCommit={editable?.onHint ? (v) => editable.onHint!(s.id, v) : undefined} css={css('hints')} selected={sel('hints')} onSelect={pick('hints')} />)</span> : null}</span>
              <span className="flex-1">{renderText(s)}</span>
            </li>
          ))}
        </ol>
      );
    }
    // word_bank & brackets: một cột; brackets thêm cột gợi ý bên phải
    return (
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {sentences.map((s, i) => (
          <li key={s.id} className="flex items-baseline gap-[2mm]" style={{ breakInside: 'avoid', marginBottom: gap }}>
            {num(i)}
            <span className="flex-1">{renderText(s)}</span>
            {layout === 'brackets' && <span style={{ flex: '0 0 32mm', textAlign: 'right' }}>{renderHint(s)}</span>}
          </li>
        ))}
      </ol>
    );
  };

  const showBank = settings.showWordBank && words.length > 0;

  return (
    <div style={{ fontFamily: font, fontSize: `${settings.fontSizePt}pt`, lineHeight: settings.lineHeight, color: '#111' }}>
      {!hideExerciseHeading && settings.showExerciseTitle && dialogueGapFill && (
        <div className="flex items-start justify-between gap-[5mm] mb-[2.5mm]">
          <h2 style={{ margin: 0, color: ORANGE, fontFamily: HEAD_FONT, fontWeight: 800, fontSize: `${settings.headingFontSizePt}pt`, textTransform: 'uppercase', lineHeight: 1.25, ...css('title') }}>
            {editable?.onTitle
              ? <EditableText value={data.exerciseTitle} onCommit={editable.onTitle} selected={sel('title')} onSelect={pick('title')} />
              : <span onClick={pick('title')}><EditableText value={data.exerciseTitle}>{data.exerciseTitle}</EditableText></span>}
          </h2>
          {qr}
        </div>
      )}
      {!hideExerciseHeading && settings.showExerciseTitle && !dialogueGapFill && (
        <div className="flex items-start justify-between gap-[5mm] mb-[3.5mm]">
          <div className="flex items-start gap-[3mm] min-w-0 flex-1">
            <span
              style={{ width: '5.6mm', height: '5.6mm', background: NAVY, color: '#fff', borderRadius: '1mm', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11pt', fontFamily: HEAD_FONT, lineHeight: 1, flexShrink: 0, marginTop: '0.5mm' }}
            >
              {data.exerciseNumber || exerciseIndex}
            </span>
            <div className="min-w-0">
              <h2 style={{ margin: 0, color: NAVY, fontFamily: HEAD_FONT, fontWeight: 800, fontSize: `${settings.headingFontSizePt}pt`, textTransform: 'uppercase', lineHeight: 1.3, ...css('title') }}>
                {editable?.onTitle
                  ? <EditableText value={data.exerciseTitle} onCommit={editable.onTitle} selected={sel('title')} onSelect={pick('title')} />
                  : <span onClick={pick('title')}><EditableText value={data.exerciseTitle}>{titleNode}</EditableText></span>}
              </h2>
              {data.instruction && !editable?.onTitle && null}
            </div>
          </div>
          {qr}
        </div>
      )}
      {hideExerciseHeading && qr && <div className="flex justify-end mb-[3mm]">{qr}</div>}

      {showBank && !dialogueGapFill && (
        <div
          style={{ margin: '0 auto 5mm', width: '92%', border: '1pt solid #111', borderRadius: '2.5mm', padding: '2mm 6mm', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '9mm', rowGap: '1mm', fontWeight: 700, ...css('wordBank') }}
        >
          {words.map((w) => (
            <span key={w.id}>
              <EditableText value={w.text} onCommit={editable?.onWord ? (v) => editable.onWord!(w.id, v) : undefined} css={css('wordBank')} selected={sel('wordBank')} onSelect={pick('wordBank')} />
            </span>
          ))}
        </div>
      )}

      {renderBody()}
    </div>
  );
};
