import React from 'react';
import type { HeadingStyleKey, MatchingHeadingsData } from '../../services/matching-headings/matchingHeadingsCore';
import { ideaLabel } from '../../services/matching-headings/matchingHeadingsCore';
import { textStyleToCss } from '../../services/matching-pictures/matchingPicturesCore';
import { RichEditable } from '../shared/rich/RichEditable';

const NAVY = '#16295f';
const HEAD_FONT = '"Roboto Condensed", "Arial Narrow", Arial, sans-serif';

export interface HeadingsEditable {
  onTitle?: (v: string) => void;
  onInstruction?: (v: string) => void;
  onPassageTitle?: (v: string) => void;
  onParagraph?: (id: string, v: string) => void;
  onIdea?: (id: string, v: string) => void;
  selectedKey?: HeadingStyleKey;
  onSelectKey?: (k: HeadingStyleKey) => void;
}

interface Props {
  data: MatchingHeadingsData;
  exerciseIndex?: number;
  hideExerciseHeading?: boolean;
  /** Có giá trị: chữ sửa trực tiếp được trên trang (Edit Mode) */
  editable?: HeadingsEditable;
}

/** Chữ sửa trực tiếp như Word: bấm là có con trỏ; bấm ra ngoài để lưu, Esc để hủy */
const EditableText: React.FC<{
  value: string;
  onCommit?: (v: string) => void;
  css?: React.CSSProperties;
  selected?: boolean;
  onSelect?: () => void;
  /** Đoạn dài: cho phép chữ xuống dòng tự nhiên, Enter không xuống dòng */
  inline?: boolean;
}> = ({ value, onCommit, css, selected, onSelect, inline }) => (
  <RichEditable value={value} onCommit={onCommit} css={css} selected={selected} onSelect={onSelect} display={inline ? 'inline' : 'inline-block'} />
);

export const MatchingHeadingsRenderer: React.FC<Props> = ({ data, exerciseIndex = 1, hideExerciseHeading = false, editable }) => {
  const { settings, paragraphs, ideas } = data;
  const css = (k: HeadingStyleKey) => textStyleToCss(data.textStyles?.[k]) as React.CSSProperties;
  const sel = (k: HeadingStyleKey) => editable?.selectedKey === k;
  const pick = (k: HeadingStyleKey) => (editable?.onSelectKey ? () => editable.onSelectKey!(k) : undefined);
  const rows = Math.max(paragraphs.length, ideas.length);
  const divider = settings.layout === 'list_divider';
  const img = data.image || {};
  const ratio = img.ratio || 3 / 2;
  const showImageBox = settings.showImage && (!!img.url || !!editable);
  const font = settings.fontFamily && settings.fontFamily !== 'Arial'
    ? `${settings.fontFamily}, "Segoe UI", Arial, sans-serif`
    : 'Arial, sans-serif';

  return (
    <div style={{ fontFamily: font, fontSize: `${settings.fontSizePt}pt`, lineHeight: settings.lineHeight, color: '#111' }}>
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
          <h2 style={{ margin: 0, color: NAVY, fontFamily: HEAD_FONT, fontWeight: 800, fontSize: `${settings.headingFontSizePt}pt`, textTransform: 'uppercase', ...css('title') }}>
            <EditableText value={data.exerciseTitle} onCommit={editable?.onTitle} selected={sel('title')} onSelect={pick('title')} />
          </h2>
        </div>
      )}
      {!hideExerciseHeading && settings.showInstruction && data.instruction && (
        <p className="italic mb-[3mm]" style={{ fontSize: '10pt', ...css('instruction') }}>
          <EditableText value={data.instruction} onCommit={editable?.onInstruction} selected={sel('instruction')} onSelect={pick('instruction')} />
        </p>
      )}

      {settings.showPassageTitle && data.passageTitle && (
        <h3 style={{ margin: '0 0 3mm', textAlign: 'center', fontWeight: 800, textTransform: 'uppercase', fontSize: `${settings.fontSizePt + 1}pt`, color: '#0f172a', ...css('passageTitle') }}>
          <EditableText value={data.passageTitle} onCommit={editable?.onPassageTitle} selected={sel('passageTitle')} onSelect={pick('passageTitle')} />
        </h3>
      )}

      {/* Bài đọc: ảnh nổi bên phải, chữ chạy vòng quanh */}
      {settings.showPassage !== false && <div className="flow-root">
        {showImageBox && (
          <div style={{ float: 'right', width: `${settings.imageWidthMm}mm`, margin: '1mm 0 2mm 4mm', aspectRatio: String(ratio) }}>
            {img.url ? (
              <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '3mm', display: 'block' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', border: '0.75pt dashed #9ca3af', borderRadius: '3mm', background: '#f8fafc', color: '#9ca3af', fontSize: '8pt', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Ảnh</div>
            )}
          </div>
        )}
        {paragraphs.map((p) => (
          <p key={p.id} style={{ margin: `0 0 ${settings.paragraphGapMm}mm`, textAlign: 'justify', textIndent: `${settings.firstLineIndentMm}mm`, ...css('passage') }}>
            <EditableText value={p.text} inline onCommit={editable?.onParagraph ? (v) => editable.onParagraph!(p.id, v) : undefined} selected={sel('passage')} onSelect={pick('passage')} />
          </p>
        ))}
      </div>}

      {/* Danh sách nối: Paragraph n (trái) – ý chính a, b, c (phải) */}
      {rows > 0 && (
        <div
          className="grid"
          style={{
            marginTop: '4mm',
            gridTemplateColumns: divider ? 'auto 0.4mm 1fr' : 'auto 1fr',
            columnGap: divider ? '5mm' : '8mm',
            rowGap: '1.6mm',
            ...css('ideas'),
          }}
        >
          {Array.from({ length: rows }).map((_, i) => {
            const idea = ideas[i];
            return (
              <React.Fragment key={i}>
                <div style={{ breakInside: 'avoid', paddingRight: '8mm', whiteSpace: 'nowrap' }}>
                  {paragraphs[i] && (
                    <>
                      <strong style={{ display: 'inline-block', minWidth: '7mm', fontWeight: 800 }}>{i + 1}.</strong>
                      <span>Paragraph {i + 1}</span>
                    </>
                  )}
                </div>
                {divider && <div style={{ background: '#cbd5e1' }} />}
                <div className="flex items-start gap-[2mm]" style={{ breakInside: 'avoid' }}>
                  {idea && (
                    <>
                      <strong style={{ minWidth: '4mm', fontWeight: 800 }}>{ideaLabel(i)}.</strong>
                      <span className="flex-1 min-w-0">
                        <EditableText value={idea.text} inline onCommit={editable?.onIdea ? (v) => editable.onIdea!(idea.id, v) : undefined} selected={sel('ideas')} onSelect={pick('ideas')} />
                      </span>
                    </>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};
