import React from 'react';
import type { VocabStyleKey, MatchingVocabularyData } from '../../services/matching-vocabulary/matchingVocabularyCore';
import { definitionLabel } from '../../services/matching-vocabulary/matchingVocabularyCore';
import { textStyleToCss } from '../../services/matching-pictures/matchingPicturesCore';

const NAVY = '#16295f';
const HEAD_FONT = '"Roboto Condensed", "Arial Narrow", Arial, sans-serif';

export interface VocabEditable {
  onTitle?: (v: string) => void;
  onInstruction?: (v: string) => void;
  onWord?: (id: string, v: string) => void;
  onDefinition?: (id: string, v: string) => void;
  selectedKey?: VocabStyleKey;
  onSelectKey?: (k: VocabStyleKey) => void;
}

interface Props {
  data: MatchingVocabularyData;
  exerciseIndex?: number;
  hideExerciseHeading?: boolean;
  /** Có giá trị: chữ sửa trực tiếp được trên trang (Edit Mode) */
  editable?: VocabEditable;
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

export const MatchingVocabularyRenderer: React.FC<Props> = ({ data, exerciseIndex = 1, hideExerciseHeading = false, editable }) => {
  const { settings, words, definitions } = data;
  const css = (k: VocabStyleKey) => textStyleToCss(data.textStyles?.[k]) as React.CSSProperties;
  const sel = (k: VocabStyleKey) => editable?.selectedKey === k;
  const pick = (k: VocabStyleKey) => (editable?.onSelectKey ? () => editable.onSelectKey!(k) : undefined);
  const rows = Math.max(words.length, definitions.length);
  const plain = settings.layout === 'plain_list';
  const box = plain ? 0 : settings.answerBoxSizeMm;
  const showBoxes = !plain && settings.showAnswerBoxes;
  const showDivider = !plain && settings.showDivider;

  return (
    <div style={{ fontFamily: `${settings.fontFamily || 'Arial'}, sans-serif`, fontSize: `${settings.fontSizePt}pt`, lineHeight: settings.lineHeight, color: '#111' }}>
      {!hideExerciseHeading && settings.showExerciseTitle && (
        <div className="flex items-center gap-[3mm] mb-[3mm]">
          <span
            style={{
              width: '5.6mm', height: '5.6mm', background: NAVY, color: '#fff', borderRadius: '1mm', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11pt', fontFamily: HEAD_FONT, lineHeight: 1,
            }}
          >
            {data.exerciseNumber || exerciseIndex}
          </span>
          <h2 style={{ margin: 0, color: plain ? NAVY : '#1d4ed8', fontFamily: HEAD_FONT, fontWeight: 800, fontSize: `${settings.headingFontSizePt}pt`, textTransform: 'uppercase', ...css('title') }}>
            <EditableText value={data.exerciseTitle} onCommit={editable?.onTitle} selected={sel('title')} onSelect={pick('title')} />
          </h2>
        </div>
      )}
      {settings.showInstruction && data.instruction && (
        <p className="italic mb-[3mm]" style={{ fontSize: '10pt', ...css('instruction') }}>
          <EditableText value={data.instruction} onCommit={editable?.onInstruction} selected={sel('instruction')} onSelect={pick('instruction')} />
        </p>
      )}

      <div
        className="grid"
        style={{ gridTemplateColumns: plain ? '1fr 1.6fr' : showDivider ? '1fr 0.4mm 1fr' : '1fr 1fr', columnGap: plain ? '10mm' : '6mm', rowGap: `${plain ? Math.min(settings.rowGapMm, 3) : settings.rowGapMm}mm` }}
      >
        {Array.from({ length: rows }).map((_, i) => {
          const w = words[i];
          const d = definitions[i];
          return (
            <React.Fragment key={i}>
              <div className="flex items-center gap-[3mm]" style={{ breakInside: 'avoid', minHeight: `${box}mm` }}>
                {w && (
                  <>
                    {settings.showNumbering && <strong style={{ minWidth: '6mm', fontWeight: 800 }}>{i + 1}.</strong>}
                    <span className="flex-1" style={css('words')}>
                      <EditableText value={w.text} onCommit={editable?.onWord ? (v) => editable.onWord!(w.id, v) : undefined} css={css('words')} selected={sel('words')} onSelect={pick('words')} />
                    </span>
                    {showBoxes && (
                      <span className="shrink-0" style={{ width: `${box}mm`, height: `${box * 0.9}mm`, border: '0.75pt solid #444', borderRadius: '1.2mm' }} />
                    )}
                  </>
                )}
              </div>
              {showDivider && <div style={{ background: '#cbd5e1' }} />}
              <div className="flex items-center gap-[3mm]" style={{ breakInside: 'avoid', minHeight: `${box}mm` }}>
                {d && (
                  <>
                    {settings.showNumbering && <strong style={{ minWidth: '5mm', fontWeight: 800 }}>{definitionLabel(i)}.</strong>}
                    <span className="flex-1">
                      <EditableText value={d.text} onCommit={editable?.onDefinition ? (v) => editable.onDefinition!(d.id, v) : undefined} css={css('definitions')} selected={sel('definitions')} onSelect={pick('definitions')} />
                    </span>
                  </>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
