import React from 'react';
import type { McqQuestion } from '../../services/grammar-mcq/grammarMcqCore';
import { optionLabel, splitBlanks } from '../../services/grammar-mcq/grammarMcqCore';
import type { ReadingMcqData, ReadingStyleKey } from '../../services/reading-mcq/readingMcqCore';
import { splitParagraphs } from '../../services/reading-mcq/readingMcqCore';
import { textStyleToCss } from '../../services/matching-pictures/matchingPicturesCore';

const NAVY = '#16295f';
const HEAD_FONT = '"Roboto Condensed", "Arial Narrow", Arial, sans-serif';

export interface ReadingMcqEditable {
  onTitle?: (v: string) => void;
  onInstruction?: (v: string) => void;
  onPassageTitle?: (v: string) => void;
  onPassageAuthor?: (v: string) => void;
  /** Sửa một đoạn văn theo vị trí */
  /** Bấm khung ảnh trống để tải ảnh bài báo */
  onPickImage?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onParagraph?: (index: number, v: string) => void;
  onQuestion?: (id: string, v: string) => void;
  onOption?: (qid: string, oid: string, v: string) => void;
  selectedKey?: ReadingStyleKey;
  onSelectKey?: (k: ReadingStyleKey) => void;
  selectedQuestionId?: string | null;
  onSelectQuestion?: (id: string) => void;
}

interface Props {
  data: ReadingMcqData;
  exerciseIndex?: number;
  hideExerciseHeading?: boolean;
  editable?: ReadingMcqEditable;
}

/** Chữ sửa trực tiếp như Word: bấm là có con trỏ; bấm ra ngoài hoặc Enter để lưu, Esc để hủy */
const EditableText: React.FC<{
  value: string;
  onCommit?: (v: string) => void;
  css?: React.CSSProperties;
  selected?: boolean;
  onSelect?: () => void;
  block?: boolean;
}> = ({ value, onCommit, css, selected, onSelect, block }) => {
  if (!onCommit) return <span style={css}>{value}</span>;
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      className="rounded-[2px] cursor-text caret-blue-600 hover:bg-blue-50 focus:bg-blue-50/60 focus:outline focus:outline-1 focus:outline-blue-400 focus:outline-offset-2"
      style={{ ...css, display: block ? 'inline' : 'inline-block', minWidth: '3ch', outline: selected ? '1px solid #8b5cf6' : undefined, outlineOffset: '2px' }}
      onFocus={onSelect}
      onClick={onSelect}
      onBlur={(e) => {
        const v = e.currentTarget.innerText.replace(/ /g, ' ').replace(/\s*\n+\s*/g, ' ').trim();
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

export const ReadingMcqRenderer: React.FC<Props> = ({ data, exerciseIndex = 1, hideExerciseHeading = false, editable }) => {
  const { settings, questions } = data;
  const css = (k: ReadingStyleKey) => textStyleToCss(data.textStyles?.[k]) as React.CSSProperties;
  const sel = (k: ReadingStyleKey) => editable?.selectedKey === k;
  const pick = (k: ReadingStyleKey) => (editable?.onSelectKey ? () => editable.onSelectKey!(k) : undefined);
  const paragraphs = splitParagraphs(data.passage);
  const showImage = settings.showPassageImage && !!data.imageUrl;
  const showFrame = settings.showPassageImage && !data.imageUrl;

  const blankSpan = (key: string) => (
    <span key={key} style={{ display: 'inline-block', width: '22mm', borderBottom: '0.75pt solid #222', margin: '0 0.6mm', lineHeight: 1, verticalAlign: 'baseline' }}>&nbsp;</span>
  );

  const renderText = (q: McqQuestion) => {
    if (editable?.onQuestion) {
      return <EditableText value={q.text} onCommit={(v) => editable.onQuestion!(q.id, v)} css={css('questions')} selected={sel('questions')} onSelect={pick('questions')} />;
    }
    return (
      <span style={css('questions')}>
        {splitBlanks(q.text).map((p, i) => (p.type === 'blank' ? blankSpan(String(i)) : <span key={i}>{p.text}</span>))}
      </span>
    );
  };

  const renderOption = (q: McqQuestion, oi: number) => {
    const o = q.options[oi];
    return (
      <div key={o.id} style={css('options')}>
        <strong style={{ fontWeight: 800 }}>{optionLabel(oi, settings.optionLabelStyle)}.</strong>{' '}
        <EditableText value={o.text} onCommit={editable?.onOption ? (v) => editable.onOption!(q.id, o.id, v) : undefined} css={css('options')} selected={sel('options')} onSelect={pick('options')} />
      </div>
    );
  };

  const passageBlock = (data.passageTitle || data.passageAuthor || paragraphs.length > 0) && (
    <div style={{ marginBottom: '4mm', overflow: 'hidden' }}>
      {(data.passageTitle || editable?.onPassageTitle) && (
        <h3 style={{ margin: '0 0 1mm', textAlign: 'center', fontWeight: 800, textTransform: 'uppercase', fontSize: '1.05em', ...css('passageTitle') }}>
          <EditableText value={data.passageTitle} onCommit={editable?.onPassageTitle} selected={sel('passageTitle')} onSelect={pick('passageTitle')} />
        </h3>
      )}
      {(data.passageAuthor || editable?.onPassageAuthor) && (
        <p style={{ margin: '0 0 3mm', textAlign: 'center', fontStyle: 'italic', fontWeight: 700, ...css('passageAuthor') }}>
          <EditableText value={data.passageAuthor} onCommit={editable?.onPassageAuthor} selected={sel('passageAuthor')} onSelect={pick('passageAuthor')} />
        </p>
      )}
      {showImage && (
        <img
          src={data.imageUrl}
          alt=""
          style={{ float: 'right', width: `${settings.imageWidthMm}mm`, margin: '1mm 0 2mm 4mm', borderRadius: '2mm', border: '0.75pt solid #cbd5e1', objectFit: 'cover', display: 'block' }}
        />
      )}
      {showFrame && (
        <label
          className={editable?.onPickImage ? 'cursor-pointer hover:border-blue-400 hover:text-blue-600' : ''}
          style={{ float: 'right', width: `${settings.imageWidthMm}mm`, aspectRatio: '4 / 3', margin: '1mm 0 2mm 4mm', border: '0.75pt dashed #9ca3af', borderRadius: '2mm', background: '#f8fafc', color: '#9ca3af', fontSize: '9pt', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', textIndent: 0 }}
        >
          {editable?.onPickImage ? 'Bấm để thêm ảnh bài báo' : 'Ảnh bài báo'}
          {editable?.onPickImage && <input type="file" accept="image/*" hidden onChange={editable.onPickImage} />}
        </label>
      )}
      {paragraphs.map((p, i) => (
        <p key={i} style={{ margin: '0 0 2.2mm', textIndent: '8mm', textAlign: settings.justifyPassage ? 'justify' : 'left', ...css('passage') }}>
          <EditableText block value={p} onCommit={editable?.onParagraph ? (v) => editable.onParagraph!(i, v) : undefined} css={css('passage')} selected={sel('passage')} onSelect={pick('passage')} />
        </p>
      ))}
    </div>
  );

  return (
    <div style={{ fontFamily: `${settings.fontFamily || 'Arial'}, sans-serif`, fontSize: `${settings.fontSizePt}pt`, lineHeight: settings.lineHeight, color: '#111' }}>
      {!hideExerciseHeading && settings.showExerciseTitle && (
        <div className="flex items-center gap-[2.5mm] mb-[3mm]">
          <span style={{ width: '5.4mm', height: '5.4mm', background: NAVY, color: '#fff', borderRadius: '1mm', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11pt', fontFamily: HEAD_FONT, lineHeight: 1, flexShrink: 0 }}>
            {data.exerciseNumber || exerciseIndex}
          </span>
          <h2 style={{ margin: 0, color: NAVY, fontFamily: HEAD_FONT, fontWeight: 800, fontSize: `${settings.headingFontSizePt}pt`, textTransform: 'uppercase', lineHeight: 1.3, ...css('title') }}>
            <EditableText value={data.exerciseTitle} onCommit={editable?.onTitle} selected={sel('title')} onSelect={pick('title')} />
          </h2>
        </div>
      )}
      {settings.showInstruction && data.instruction && !hideExerciseHeading && (
        <p className="italic mb-[3mm]" style={{ fontSize: '10pt', fontWeight: 700, ...css('instruction') }}>
          <EditableText value={data.instruction} onCommit={editable?.onInstruction} selected={sel('instruction')} onSelect={pick('instruction')} />
        </p>
      )}
      {passageBlock}
      <div>
        {questions.map((q, i) => (
          <div
            key={q.id}
            onClick={() => editable?.onSelectQuestion?.(q.id)}
            style={{ breakInside: 'avoid', marginBottom: `${settings.questionGapMm}mm`, outline: editable?.selectedQuestionId === q.id ? '1px dashed #3b82f6' : undefined, outlineOffset: '1.5mm' }}
          >
            <div className="flex items-start gap-[1.5mm]">
              {settings.showNumbering && <strong style={{ minWidth: '7mm', fontWeight: 800 }}>{i + 1}.</strong>}
              <span className="flex-1" >{renderText(q)}</span>
              {data.shortAnswer && <span className="shrink-0" style={{ width: '68mm', borderBottom: '0.75pt solid #444', alignSelf: 'flex-end', height: '1em' }} />}
              {settings.showAnswerBoxes && <span className="shrink-0" style={{ width: '7mm', height: '6mm', border: '0.75pt solid #444', borderRadius: '1mm' }} />}
            </div>
            {!data.shortAnswer && <div style={{ paddingLeft: '7mm', marginTop: '0.8mm' }}>{q.options.map((_, oi) => renderOption(q, oi))}</div>}
          </div>
        ))}
      </div>
    </div>
  );
};
