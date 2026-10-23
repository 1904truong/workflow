import React from 'react';
import type { FaceMark, TableSentencesData, TsStyleKey } from '../../services/table-sentences/tableSentencesCore';
import { textStyleToCss } from '../../services/matching-pictures/matchingPicturesCore';
import { RichEditable } from '../shared/rich/RichEditable';

const NAVY = '#16295f';
const ORANGE = '#e8803a';
const HEAD_FONT = '"Roboto Condensed", "Arial Narrow", Arial, sans-serif';

export interface TsEditable {
  onTitle?: (v: string) => void;
  onInstruction?: (v: string) => void;
  onRowLabel?: (rowId: string, v: string) => void;
  onColumnLabel?: (colId: string, v: string) => void;
  /** Bấm vào ô mặt cười / buồn */
  onCell?: (rowId: string, colId: string) => void;
  selectedKey?: TsStyleKey;
  onSelectKey?: (k: TsStyleKey) => void;
}

interface Props {
  data: TableSentencesData;
  exerciseIndex?: number;
  hideExerciseHeading?: boolean;
  editable?: TsEditable;
}

/** Mặt cười / mặt buồn vẽ bằng SVG nét mảnh như ảnh mẫu; ô trống chỉ là vòng nét đứt mờ (chỉ hiện khi đang sửa) */
export const Face: React.FC<{ kind: FaceMark; sizeMm: number }> = ({ kind, sizeMm }) => (
  <svg width={`${sizeMm}mm`} height={`${sizeMm}mm`} viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.3" strokeLinecap="round" style={{ display: 'block', margin: '0 auto' }}>
    {kind !== '' ? (
      <>
        <circle cx="12" cy="12" r="10" />
        <circle cx="8.6" cy="9.6" r="0.6" fill="#444" />
        <circle cx="15.4" cy="9.6" r="0.6" fill="#444" />
        <path d={kind === 'happy' ? 'M7.5 14.2c1.2 2.2 3 3.2 4.5 3.2s3.3-1 4.5-3.2' : 'M7.5 17c1.2-2.2 3-3.2 4.5-3.2s3.3 1 4.5 3.2'} />
      </>
    ) : (
      <circle cx="12" cy="12" r="10" strokeDasharray="2 3" stroke="#cbd5e1" />
    )}
  </svg>
);

export const TableSentencesRenderer: React.FC<Props> = ({ data, exerciseIndex = 1, hideExerciseHeading = false, editable }) => {
  const { settings, columns, rows } = data;
  const css = (k: TsStyleKey) => textStyleToCss(data.textStyles?.[k]) as React.CSSProperties;
  const sel = (k: TsStyleKey) => editable?.selectedKey === k;
  const pick = (k: TsStyleKey) => (editable?.onSelectKey ? () => editable.onSelectKey!(k) : undefined);
  const cellBorder = `0.75pt solid ${ORANGE}`;
  const firstColMm = 24;

  return (
    <div style={{ fontFamily: `${settings.fontFamily || 'Arial'}, sans-serif`, fontSize: `${settings.fontSizePt}pt`, lineHeight: settings.lineHeight, color: '#111' }}>
      {!hideExerciseHeading && settings.showExerciseTitle && (
        <div className="flex items-start gap-[3mm] mb-[8mm]">
          <span style={{ width: '1.8mm', alignSelf: 'stretch', background: ORANGE, borderRadius: '0.5mm', flexShrink: 0 }} aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 style={{ margin: 0, color: ORANGE, fontFamily: HEAD_FONT, fontWeight: 800, fontSize: `${settings.headingFontSizePt}pt`, textTransform: 'uppercase', lineHeight: 1.3, ...css('title') }}>
              <span style={{ color: NAVY, marginRight: '2mm' }}>{data.exerciseNumber || exerciseIndex}.</span>
              <RichEditable value={data.exerciseTitle} onCommit={editable?.onTitle} css={css('title')} selected={sel('title')} onSelect={pick('title')} />
            </h2>
            {data.instruction && (
              <p className="italic mt-[1.5mm]" style={{ fontSize: '10pt', ...css('instruction') }}>
                <RichEditable value={data.instruction} onCommit={editable?.onInstruction} css={css('instruction')} selected={sel('instruction')} onSelect={pick('instruction')} />
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex items-start gap-[6mm]" style={{ breakInside: 'avoid' }}>
        <table style={{ width: `${settings.tableWidthPct}%`, borderCollapse: 'collapse', tableLayout: 'fixed', flexShrink: 0 }}>
          <colgroup>
            <col style={{ width: `${firstColMm}mm` }} />
            {columns.map((c) => <col key={c.id} />)}
          </colgroup>
          <thead>
            <tr>
              <td style={{ border: 'none' }} />
              {columns.map((c) => (
                <td key={c.id} style={{ border: cellBorder, height: `${settings.imageHeightMm}mm`, textAlign: 'center', verticalAlign: 'middle', padding: '1mm' }}>
                  {c.imageUrl ? (
                    <img src={c.imageUrl} alt={c.label} style={{ maxWidth: '100%', maxHeight: `${settings.imageHeightMm - 3}mm`, objectFit: 'contain', display: 'inline-block' }} />
                  ) : (
                    <span style={{ fontSize: '9pt', ...css('table') }}>
                      <RichEditable value={c.label} onCommit={editable?.onColumnLabel ? (v) => editable.onColumnLabel!(c.id, v) : undefined} css={css('table')} selected={sel('table')} onSelect={pick('table')} fallback={c.label || (editable ? 'Ảnh' : '')} />
                    </span>
                  )}
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ border: cellBorder, textAlign: 'center', padding: '1.5mm 1mm', ...css('table') }}>
                  <RichEditable value={r.label} onCommit={editable?.onRowLabel ? (v) => editable.onRowLabel!(r.id, v) : undefined} css={css('table')} selected={sel('table')} onSelect={pick('table')} fallback={r.label || (editable ? '…' : '')} />
                </td>
                {columns.map((c) => {
                  const face = r.cells[c.id] || '';
                  return (
                    <td
                      key={c.id}
                      onClick={editable?.onCell ? () => editable.onCell!(r.id, c.id) : undefined}
                      title={editable?.onCell ? 'Bấm để đổi: trống → cười → buồn' : undefined}
                      style={{ border: cellBorder, padding: '1.5mm', height: `${settings.faceSizeMm + 5}mm`, cursor: editable?.onCell ? 'pointer' : undefined }}
                    >
                      {face !== '' || editable?.onCell ? <Face kind={face} sizeMm={settings.faceSizeMm} /> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex-1 min-w-0" style={{ paddingTop: '1mm' }}>
          {Array.from({ length: settings.lineCount }, (_, i) => (
            <div key={i} style={{ borderBottom: '1pt dashed #444', height: `${settings.lineGapMm}mm` }} />
          ))}
        </div>
      </div>
    </div>
  );
};
