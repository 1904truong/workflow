import type { ReactNode } from 'react';
import { PRINT_TOKENS } from '../../tokens/printTokens';

interface WorksheetPageProps {
  pageNumber: number;
  totalPages: number;
  children: ReactNode;
}

export const WorksheetPage = ({
  children,
}: WorksheetPageProps) => {
  return (
    <div
      data-not-typeset
      className="not-typeset worksheet-page bg-white shadow-xl mx-auto relative flex flex-col box-border transition-all select-text print:shadow-none print:m-0"
      style={{
        width: `${PRINT_TOKENS.page.widthMm}mm`,
        minHeight: `${PRINT_TOKENS.page.heightMm}mm`,
        paddingTop: `${PRINT_TOKENS.page.marginTopMm}mm`,
        paddingBottom: `${PRINT_TOKENS.page.marginBottomMm}mm`,
        paddingLeft: `${PRINT_TOKENS.page.marginLeftMm}mm`,
        paddingRight: `${PRINT_TOKENS.page.marginRightMm}mm`,
        fontFamily: PRINT_TOKENS.typography.fontFamily,
        // Pinned so the A4 sheet does not inherit the web UI's body size.
        fontSize: '15px',
        lineHeight: 1.75,
        color: PRINT_TOKENS.page.textColor,
        backgroundColor: PRINT_TOKENS.page.backgroundColor,
      }}
    >
      {/* 180mm x 267mm Printable Content Container */}
      <div 
        className="w-full flex-1 flex flex-col justify-between"
        style={{
          width: `${PRINT_TOKENS.page.printableWidthMm}mm`,
          minHeight: `${PRINT_TOKENS.page.printableHeightMm}mm`,
        }}
      >
        {children}
      </div>
    </div>
  );
};
