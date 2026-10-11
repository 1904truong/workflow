import { useMemo } from 'react';
import type { Worksheet } from '../../types';
import { WorksheetPage } from './WorksheetPage';
import { WorksheetHeader } from './WorksheetHeader';
import { WorksheetFooter } from './WorksheetFooter';
import { ExerciseBlock } from './ExerciseBlock';

interface WorksheetRendererProps {
  worksheet: Worksheet;
}

export const WorksheetRenderer: React.FC<WorksheetRendererProps> = ({ worksheet }) => {
  // Simple sensible pagination algorithm:
  // If exercises are many or long, group them into pages.
  const pages = useMemo(() => {
    const list = worksheet.exercises;
    if (list.length === 0) {
      return [[]];
    }

    // Grouping strategy:
    // Page 1 has the large Header + Student Box (~40mm), so fits fewer exercises (e.g., 1-2).
    // Subsequent pages have more printable space (fits ~2-3 exercises).
    const result: typeof list[] = [];
    let currentPage: typeof list = [];
    let currentScore = 0; // heuristic unit based on passage length + questions count + images

    list.forEach((ex, idx) => {
      let weight = 1;
      if (ex.passage && ex.passage.length > 300) weight += 2;
      if (ex.questions.length > 4) weight += 1;
      if (ex.imageSlots.length > 2) weight += 1.5;
      if (ex.layoutType === 'template_e' || ex.tableData) weight += 1.5;

      const maxWeightForCurrentPage = result.length === 0 ? 3.5 : 4.5;

      if (currentPage.length > 0 && currentScore + weight > maxWeightForCurrentPage) {
        result.push(currentPage);
        currentPage = [ex];
        currentScore = weight;
      } else {
        currentPage.push(ex);
        currentScore += weight;
      }

      if (idx === list.length - 1 && currentPage.length > 0) {
        result.push(currentPage);
      }
    });

    return result.length > 0 ? result : [[]];
  }, [worksheet.exercises]);

  return (
    <div className="worksheet-document flex flex-col gap-8 print:gap-0">
      {pages.map((pageExercises, pIdx) => (
        <WorksheetPage
          key={pIdx}
          pageNumber={pIdx + 1}
          totalPages={pages.length}
        >
          <div className="flex-1 flex flex-col">
            {/* Header on first page only */}
            {pIdx === 0 && <WorksheetHeader worksheet={worksheet} />}

            {/* Small Running Header on page 2+ */}
            {pIdx > 0 && (
              <div className="w-full flex justify-between text-[8.5pt] text-[#555555] pb-[2mm] mb-[4mm] border-b border-[#cccccc]">
                <span className="font-semibold">{worksheet.title}</span>
                <span>{worksheet.unit || 'English Worksheet'}</span>
              </div>
            )}

            {/* Exercises assigned to this page */}
            <div className="flex-1">
              {pageExercises.length === 0 ? (
                <div className="p-8 text-center text-[#888888] italic">
                  No exercises added yet. Use the Left Sidebar to add an exercise.
                </div>
              ) : (
                pageExercises.map((exercise, eIdx) => (
                  <ExerciseBlock
                    key={exercise.id}
                    exercise={exercise}
                    printSettings={worksheet.printSettings}
                    exerciseIndex={pIdx * 2 + eIdx}
                  />
                ))
              )}
            </div>

            {/* Footer with Page Numbers */}
            <WorksheetFooter
              pageNumber={pIdx + 1}
              totalPages={pages.length}
              schoolName={worksheet.schoolName}
            />
          </div>
        </WorksheetPage>
      ))}
    </div>
  );
};
