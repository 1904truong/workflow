import { PRINT_TOKENS } from '../../tokens/printTokens';

interface WorksheetFooterProps {
  pageNumber: number;
  totalPages: number;
  schoolName?: string;
}

export const WorksheetFooter = ({
  pageNumber,
  totalPages,
  schoolName,
}: WorksheetFooterProps) => {
  return (
    <footer 
      className="w-full pt-[2mm] mt-auto flex justify-between items-center text-[8pt] text-[#777777]"
      style={{ 
        borderTop: PRINT_TOKENS.borders.footerDivider,
        fontFamily: PRINT_TOKENS.typography.fontFamily 
      }}
    >
      <div>
        <span>{schoolName || 'English Language Curriculum'}</span>
        <span className="mx-2">•</span>
        <span>Standard ISO A4 Printable</span>
      </div>

      <div className="font-medium text-[#444444]">
        Page {pageNumber} of {totalPages}
      </div>
    </footer>
  );
};
