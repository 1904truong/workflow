import type { Worksheet } from '../../types';
import { PRINT_TOKENS } from '../../tokens/printTokens';

interface WorksheetHeaderProps {
  worksheet: Worksheet;
}

export const WorksheetHeader: React.FC<WorksheetHeaderProps> = ({ worksheet }) => {
  const { showStudentInfo, mode } = worksheet.printSettings;

  return (
    <header className="w-full text-[#111111] mb-[6mm]">
      {/* Top Meta & School info */}
      <div className="flex justify-between items-center text-[9pt] text-[#444444] pb-[1mm]">
        <div className="font-medium">
          {worksheet.schoolName || 'ACADEMIC ENGLISH DEPARTMENT'}
        </div>
        <div className="flex gap-3">
          {worksheet.unit && <span>{worksheet.unit}</span>}
          {worksheet.lesson && <span>• {worksheet.lesson}</span>}
          {worksheet.gradeLevel && <span>• Grade {worksheet.gradeLevel}</span>}
        </div>
      </div>

      {/* Main Title & Mode Badge */}
      <div className="flex justify-between items-baseline pt-[1mm] pb-[2mm]">
        <h1 
          className="font-bold text-[16pt] leading-[1.2] text-[#111111] tracking-tight uppercase"
          style={{ fontFamily: PRINT_TOKENS.typography.fontFamily }}
        >
          {worksheet.title || 'ENGLISH WORKSHEET'}
        </h1>
        {mode === 'teacher_key' && (
          <span className="px-2 py-0.5 border border-red-600 text-red-600 font-bold text-[9pt] uppercase tracking-wider rounded">
            Teacher Answer Key
          </span>
        )}
      </div>

      {/* Student Information Box */}
      {showStudentInfo && (
        <div 
          className="pt-[2mm] pb-[3mm] border-t border-b border-[#888888] my-[2mm] text-[10pt]"
          style={{ borderTop: PRINT_TOKENS.borders.headerDivider, borderBottom: PRINT_TOKENS.borders.headerDivider }}
        >
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-5 flex items-baseline">
              <span className="font-semibold text-[9pt] mr-1">Student Name:</span>
              <span className="flex-1 border-b border-dotted border-[#666666] min-h-[14px]"></span>
            </div>
            <div className="col-span-3 flex items-baseline">
              <span className="font-semibold text-[9pt] mr-1">Class:</span>
              <span className="flex-1 border-b border-dotted border-[#666666] min-h-[14px]"></span>
            </div>
            <div className="col-span-4 flex items-baseline">
              <span className="font-semibold text-[9pt] mr-1">Date:</span>
              <span className="flex-1 border-b border-dotted border-[#666666] min-h-[14px]"></span>
            </div>
          </div>
          
          <div className="grid grid-cols-12 gap-2 mt-2 pt-1 text-[9pt] text-[#555555]">
            <div className="col-span-8">
              <span>Time Allowed: {worksheet.totalTimeMinutes ? `${worksheet.totalTimeMinutes} minutes` : '45 minutes'}</span>
              {worksheet.teacherName && <span className="ml-4">Teacher: {worksheet.teacherName}</span>}
            </div>
            <div className="col-span-4 text-right font-semibold text-[#111111]">
              Total Score: ______ / {worksheet.totalPoints || 100} pts
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
