import type { TableData } from '../../types';
import { PRINT_TOKENS } from '../../tokens/printTokens';

interface WorksheetTableProps {
  tableData: TableData;
  isTeacherKey?: boolean;
}

export const WorksheetTable: React.FC<WorksheetTableProps> = ({
  tableData,
  isTeacherKey = false,
}) => {
  if (!tableData || !tableData.headers || tableData.headers.length === 0) {
    return null;
  }

  return (
    <div className="w-full my-[3mm] overflow-hidden">
      <table 
        className="w-full border-collapse text-[10pt]"
        style={{ 
          border: PRINT_TOKENS.borders.table,
          fontFamily: PRINT_TOKENS.typography.fontFamily 
        }}
      >
        <thead>
          <tr className="bg-[#f3f4f6]">
            {tableData.headers.map((header, idx) => (
              <th
                key={idx}
                className="font-bold text-left text-[#111111]"
                style={{
                  border: PRINT_TOKENS.borders.table,
                  padding: `${PRINT_TOKENS.spacing.tableCellPaddingMm}mm`,
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableData.rows.map((row, rIdx) => (
            <tr key={rIdx} className={rIdx % 2 === 1 ? 'bg-[#fafafa]' : 'bg-white'}>
              {row.map((cell, cIdx) => (
                <td
                  key={cIdx}
                  className="align-top"
                  style={{
                    border: PRINT_TOKENS.borders.table,
                    padding: `${PRINT_TOKENS.spacing.tableCellPaddingMm}mm`,
                  }}
                >
                  {cell.isBlank ? (
                    isTeacherKey && cell.correctAnswer ? (
                      <span className="font-bold text-red-600 underline">
                        {cell.correctAnswer}
                      </span>
                    ) : (
                      <span className="inline-block w-full border-b border-dotted border-[#888888] min-h-[16px] text-transparent">
                        _
                      </span>
                    )
                  ) : (
                    <span>{cell.content}</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
