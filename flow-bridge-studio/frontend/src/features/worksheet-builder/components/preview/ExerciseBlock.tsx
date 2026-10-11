import type { Exercise, PrintSettings } from '../../types';
import { PRINT_TOKENS } from '../../tokens/printTokens';
import { QuestionRenderer } from './QuestionRenderer';
import { ImageSlotComponent } from './ImageSlotComponent';
import { WorksheetTable } from './WorksheetTable';

interface ExerciseBlockProps {
  exercise: Exercise;
  printSettings: PrintSettings;
  exerciseIndex: number;
}

export const ExerciseBlock: React.FC<ExerciseBlockProps> = ({
  exercise,
  printSettings,
  exerciseIndex,
}) => {
  const isTeacherKey = printSettings.mode === 'teacher_key';
  const showEmptyPlaceholders = printSettings.showEmptyImagePlaceholders;
  const layout = exercise.layoutType;

  return (
    <section 
      className="w-full mb-[5mm] text-[#111111]"
      style={{ fontFamily: PRINT_TOKENS.typography.fontFamily }}
    >
      {/* Exercise Heading */}
      <div className="flex justify-between items-baseline mb-[1.5mm]">
        <h2 
          className="font-bold text-[12pt] leading-[1.2] text-[#111111] uppercase tracking-wide"
        >
          {exercise.title || `Exercise ${exerciseIndex + 1}`}
        </h2>
        {exercise.pointsTotal && (
          <span className="text-[9.5pt] text-[#555555] font-semibold">
            ({exercise.pointsTotal} pts)
          </span>
        )}
      </div>

      {/* Exercise Instructions */}
      {exercise.instructions && (
        <p className="text-[10.5pt] italic text-[#333333] mb-[3mm] leading-[1.35]">
          {exercise.instructions}
        </p>
      )}

      {/* TEMPLATE A: Text Only */}
      {layout === 'template_a' && (
        <div className="space-y-[3mm]">
          {exercise.passage && (
            <div className="p-3 bg-[#fafafa] border border-[#e5e7eb] rounded text-[11pt] leading-[1.35] whitespace-pre-line mb-[3mm]">
              {exercise.passage}
            </div>
          )}

          <div className="space-y-[2.5mm]">
            {exercise.questions.map((q, idx) => (
              <QuestionRenderer
                key={q.id}
                question={q}
                exerciseType={exercise.type}
                index={idx}
                isTeacherKey={isTeacherKey}
              />
            ))}
          </div>
        </div>
      )}

      {/* TEMPLATE B: Text + Image Grid */}
      {layout === 'template_b' && (
        <div className="space-y-[3mm]">
          {/* Image Grid */}
          {exercise.imageSlots.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-[4mm] my-[2mm]">
              {exercise.imageSlots.map((slot) => (
                <ImageSlotComponent
                  key={slot.slotId}
                  slot={slot}
                  showEmptyPlaceholders={showEmptyPlaceholders}
                />
              ))}
            </div>
          )}

          {/* Questions */}
          <div className="space-y-[2.5mm] mt-[3mm]">
            {exercise.questions.map((q, idx) => (
              <QuestionRenderer
                key={q.id}
                question={q}
                exerciseType={exercise.type}
                index={idx}
                isTeacherKey={isTeacherKey}
              />
            ))}
          </div>
        </div>
      )}

      {/* TEMPLATE C: Text + Single Image */}
      {layout === 'template_c' && (
        <div>
          {/* Top image position */}
          {exercise.imagePosition === 'top' && exercise.imageSlots[0] && (
            <div className="flex justify-center mb-[3mm]">
              <ImageSlotComponent
                slot={exercise.imageSlots[0]}
                showEmptyPlaceholders={showEmptyPlaceholders}
              />
            </div>
          )}

          {/* Side by side layout for left/right */}
          {exercise.imagePosition === 'left' || exercise.imagePosition === 'right' ? (
            <div className={`flex gap-[4mm] ${exercise.imagePosition === 'right' ? 'flex-row' : 'flex-row-reverse'}`}>
              <div className="flex-1 space-y-[2.5mm]">
                {exercise.passage && (
                  <p className="text-[11pt] leading-[1.35] whitespace-pre-line mb-[2mm]">
                    {exercise.passage}
                  </p>
                )}
                {exercise.questions.map((q, idx) => (
                  <QuestionRenderer
                    key={q.id}
                    question={q}
                    exerciseType={exercise.type}
                    index={idx}
                    isTeacherKey={isTeacherKey}
                  />
                ))}
              </div>

              {exercise.imageSlots[0] && (
                <div className="shrink-0">
                  <ImageSlotComponent
                    slot={exercise.imageSlots[0]}
                    showEmptyPlaceholders={showEmptyPlaceholders}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-[2.5mm]">
              {exercise.passage && (
                <p className="text-[11pt] leading-[1.35] whitespace-pre-line mb-[2mm]">
                  {exercise.passage}
                </p>
              )}
              {exercise.questions.map((q, idx) => (
                <QuestionRenderer
                  key={q.id}
                  question={q}
                  exerciseType={exercise.type}
                  index={idx}
                  isTeacherKey={isTeacherKey}
                />
              ))}
            </div>
          )}

          {/* Bottom image position */}
          {exercise.imagePosition === 'bottom' && exercise.imageSlots[0] && (
            <div className="flex justify-center mt-[3mm]">
              <ImageSlotComponent
                slot={exercise.imageSlots[0]}
                showEmptyPlaceholders={showEmptyPlaceholders}
              />
            </div>
          )}
        </div>
      )}

      {/* TEMPLATE D: Two-Column (Reading + Questions) */}
      {layout === 'template_d' && (
        <div className="grid grid-cols-2 gap-[5mm] items-start">
          {/* Left Column: Passage / Primary Content / Single Illustration */}
          <div className="border-r border-[#e5e7eb] pr-[2.5mm] space-y-[2mm]">
            {exercise.imageSlots[0] && (
              <div className="flex justify-center mb-[2mm]">
                <ImageSlotComponent
                  slot={exercise.imageSlots[0]}
                  showEmptyPlaceholders={showEmptyPlaceholders}
                />
              </div>
            )}
            {exercise.passage ? (
              <div className="text-[11pt] leading-[1.35] text-[#222222] whitespace-pre-line text-justify">
                {exercise.passage}
              </div>
            ) : (
              <div className="p-3 text-[10pt] text-[#888888] italic bg-[#fafafa] rounded">
                No reading passage entered yet.
              </div>
            )}
          </div>

          {/* Right Column: Questions */}
          <div className="pl-[2.5mm] space-y-[2.5mm]">
            {exercise.questions.map((q, idx) => (
              <QuestionRenderer
                key={q.id}
                question={q}
                exerciseType={exercise.type}
                index={idx}
                isTeacherKey={isTeacherKey}
              />
            ))}
          </div>
        </div>
      )}

      {/* TEMPLATE E: Image + Table */}
      {layout === 'template_e' && (
        <div className="space-y-[3mm]">
          {exercise.imageSlots[0] && (
            <div className="flex justify-center">
              <ImageSlotComponent
                slot={exercise.imageSlots[0]}
                showEmptyPlaceholders={showEmptyPlaceholders}
              />
            </div>
          )}

          {exercise.tableData && (
            <WorksheetTable
              tableData={exercise.tableData}
              isTeacherKey={isTeacherKey}
            />
          )}

          {exercise.questions.length > 0 && (
            <div className="space-y-[2.5mm] mt-[3mm]">
              {exercise.questions.map((q, idx) => (
                <QuestionRenderer
                  key={q.id}
                  question={q}
                  exerciseType={exercise.type}
                  index={idx}
                  isTeacherKey={isTeacherKey}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
