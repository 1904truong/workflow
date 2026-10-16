import type { Exercise, PrintSettings } from '../../types';
import { PRINT_TOKENS } from '../../tokens/printTokens';
import { QuestionRenderer } from './QuestionRenderer';
import { ImageSlotComponent } from './ImageSlotComponent';
import { WorksheetTable } from './WorksheetTable';
import { Editable, useEdit } from './EditContext';
import { MatchingRenderer } from '../matching/MatchingRenderer';
import { ClozeRenderer } from '../cloze/ClozeRenderer';
import { ListeningGapFillRenderer } from '../listening/ListeningGapFillRenderer';
import { MatchingHeadingsRenderer } from '../matching-headings/MatchingHeadingsRenderer';
import { TfngRenderer } from '../tfng/TfngRenderer';
import { GapFillingRenderer } from '../gap-filling/GapFillingRenderer';
import { MatchingVocabularyRenderer } from '../matching-vocabulary/MatchingVocabularyRenderer';
import { ListeningTrueFalseRenderer } from '../listening-true-false/ListeningTrueFalseRenderer';
import { ListeningTableRenderer } from '../listening-table/ListeningTableRenderer';
import { GrammarMcqRenderer } from '../grammar-mcq/GrammarMcqRenderer';
import { MatchingPicturesRenderer } from '../matching-pictures/MatchingPicturesRenderer';

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
  const isTeacherKey = false; // giáo trình: không in đáp án
  const showEmptyPlaceholders = printSettings.showEmptyImagePlaceholders;
  const layout = exercise.layoutType;
  const edit = useEdit();
  // Số bài đã tự đánh ở ô vuông, nên bỏ tiền tố kiểu "Exercise 1:" trong tên để không bị lặp
  const displayTitle = (exercise.title || '').replace(/\[\[|\]\]/g, '').replace(/^\s*(exercise|bài|part|task)\s*\d+\s*[:.\-–—]\s*/i, '').trim() || exercise.title || 'Exercise';
  const field = (f: 'title' | 'instructions' | 'passage') => (v: string) => edit.setExerciseField(exercise.id, f, v);

  return (
    <section
      className={`w-full mb-[5mm] text-[#111111] ${edit.editing ? 'relative group/ex rounded hover:outline hover:outline-1 hover:outline-dashed hover:outline-violet-300 hover:outline-offset-4' : ''}`}
      style={{ fontFamily: PRINT_TOKENS.typography.fontFamily }}
    >
      {edit.editing && (
        <div className="no-print absolute -top-3 right-0 hidden group-hover/ex:flex items-center gap-1 z-10 bg-white border border-slate-200 rounded-lg shadow px-1 py-0.5 text-[10px] font-bold text-slate-600" style={{ fontFamily: 'system-ui, sans-serif' }}>
          <button type="button" className="px-1.5 py-0.5 rounded hover:bg-slate-100" title="Chuyển bài lên" onClick={() => edit.moveExercise(exercise.id, -1)}>↑</button>
          <button type="button" className="px-1.5 py-0.5 rounded hover:bg-slate-100" title="Chuyển bài xuống" onClick={() => edit.moveExercise(exercise.id, 1)}>↓</button>
          <button
            type="button"
            className={`px-1.5 py-0.5 rounded hover:bg-slate-100 ${exercise.pageBreakBefore ? 'text-violet-700 bg-violet-50' : ''}`}
            title="Bắt đầu bài này ở trang mới"
            onClick={() => edit.togglePageBreak(exercise.id)}
          >
            {exercise.pageBreakBefore ? '⏎ Trang mới ✓' : '⏎ Trang mới'}
          </button>
          <button
            type="button"
            className="px-1.5 py-0.5 rounded text-rose-600 hover:bg-rose-50"
            title="Xóa cả bài tập"
            onClick={() => { if (window.confirm(`Xóa bài "${exercise.title}"?`)) edit.deleteExercise(exercise.id); }}
          >
            ✕ Xóa bài
          </button>
        </div>
      )}
      {/* Bài Listening True / False tự vẽ tiêu đề (chữ đỏ TRUE/FALSE) cùng ảnh + QR bên phải */}
      {exercise.listeningTrueFalse && (
        <ListeningTrueFalseRenderer data={{ ...exercise.listeningTrueFalse, exerciseNumber: undefined }} exerciseIndex={exerciseIndex + 1} />
      )}

      {exercise.gapFilling && (
        <GapFillingRenderer data={{ ...exercise.gapFilling, exerciseNumber: undefined }} exerciseIndex={exerciseIndex + 1} />
      )}

      {exercise.tfng && (
        <TfngRenderer data={{ ...exercise.tfng, exerciseNumber: undefined }} exerciseIndex={exerciseIndex + 1} />
      )}

      {exercise.listeningGapFill && (
        <ListeningGapFillRenderer data={exercise.listeningGapFill} exerciseIndex={exerciseIndex + 1} isTeacherKey={isTeacherKey} />
      )}

      {exercise.grammarMcq && <GrammarMcqRenderer data={exercise.grammarMcq} exerciseIndex={exerciseIndex + 1} hideExerciseHeading={true} />}

      {exercise.listeningTable && (
        <ListeningTableRenderer data={{ ...exercise.listeningTable, exerciseNumber: undefined }} exerciseIndex={exerciseIndex + 1} />
      )}

      {!exercise.listeningTrueFalse && !exercise.tfng && !exercise.gapFilling && !exercise.listeningTable && !exercise.grammarMcq && !exercise.listeningGapFill && !exercise.listeningTable && !exercise.grammarMcq && (
      <>
      {/* Exercise Heading: ô số tự động (1, 2, 3...) + tiêu đề xanh */}
      <div className="flex items-center gap-[1.2mm] mb-[2.5mm]">
        <span
          className="shrink-0 flex items-center justify-center text-white font-bold"
          style={{ width: '5.2mm', height: '5.2mm', background: '#16295f', borderRadius: '0.9mm', fontSize: '10.5pt', fontFamily: '"Roboto Condensed", "Arial Narrow", Arial, sans-serif', lineHeight: 1 }}
        >
          {exerciseIndex + 1}
        </span>
        <h2
          className="font-bold uppercase leading-[1.2]"
          style={{ color: '#16295f', fontSize: '12.5pt', fontFamily: '"Roboto Condensed", "Arial Narrow", Arial, sans-serif', letterSpacing: '0.01em' }}
        >
          <Editable value={displayTitle} onCommit={field('title')} />
        </h2>
      </div>
      </>
      )}

      {/* Toàn bộ nội dung bài thụt vào 6mm cho thẳng hàng với chữ tiêu đề (như phiếu mẫu) */}
      <div style={{ paddingLeft: '6mm' }}>
      {/* Exercise Instructions */}
      {!exercise.cloze && !exercise.listeningGapFill && exercise.instructions && (
        <p className="text-[10.5pt] italic text-[#333333] mb-[3mm] leading-[1.35]">
          <Editable value={exercise.instructions} onCommit={field('instructions')} />
        </p>
      )}

      {exercise.matching && <MatchingRenderer data={exercise.matching} />}
      {exercise.cloze && <ClozeRenderer data={exercise.cloze} exerciseIndex={exerciseIndex + 1} hideExerciseHeading={true} />}
      {exercise.matchingHeadings && <MatchingHeadingsRenderer data={exercise.matchingHeadings} exerciseIndex={exerciseIndex + 1} hideExerciseHeading={true} />}
      {exercise.matchingVocabulary && <MatchingVocabularyRenderer data={exercise.matchingVocabulary} exerciseIndex={exerciseIndex + 1} hideExerciseHeading={true} />}
      {exercise.matchingPictures && <MatchingPicturesRenderer data={exercise.matchingPictures} exerciseIndex={exerciseIndex + 1} isTeacherKey={isTeacherKey} hideExerciseHeading={true} />}

      {/* TEMPLATE A: Text Only */}
      {!exercise.matching && !exercise.cloze && !exercise.listeningGapFill && !exercise.matchingPictures && !exercise.matchingVocabulary && !exercise.gapFilling && !exercise.tfng && !exercise.matchingHeadings && !exercise.listeningTrueFalse && !exercise.listeningTable && !exercise.grammarMcq && layout === 'template_a' && (
        <div className="space-y-[3mm]">
          {exercise.passage && (
            <div className="p-3 bg-[#fafafa] border border-[#e5e7eb] rounded text-[11pt] leading-[1.35] whitespace-pre-line mb-[3mm]">
              <Editable value={exercise.passage ?? ''} multiline onCommit={field('passage')} />
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
      {!exercise.matching && !exercise.cloze && !exercise.listeningGapFill && !exercise.matchingPictures && !exercise.matchingVocabulary && !exercise.gapFilling && !exercise.tfng && !exercise.matchingHeadings && !exercise.listeningTrueFalse && !exercise.listeningTable && !exercise.grammarMcq && layout === 'template_b' && (
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
      {!exercise.matching && !exercise.cloze && !exercise.listeningGapFill && !exercise.matchingPictures && !exercise.matchingVocabulary && !exercise.gapFilling && !exercise.tfng && !exercise.matchingHeadings && !exercise.listeningTrueFalse && !exercise.listeningTable && !exercise.grammarMcq && layout === 'template_c' && (
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
                    <Editable value={exercise.passage ?? ''} multiline onCommit={field('passage')} />
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
                  <Editable value={exercise.passage ?? ''} multiline onCommit={field('passage')} />
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
      {!exercise.matching && !exercise.cloze && !exercise.listeningGapFill && !exercise.matchingPictures && !exercise.matchingVocabulary && !exercise.gapFilling && !exercise.tfng && !exercise.matchingHeadings && !exercise.listeningTrueFalse && !exercise.listeningTable && !exercise.grammarMcq && layout === 'template_d' && (
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
                <Editable value={exercise.passage ?? ''} multiline onCommit={field('passage')} />
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
      {!exercise.matching && !exercise.cloze && !exercise.listeningGapFill && !exercise.matchingPictures && !exercise.matchingVocabulary && !exercise.gapFilling && !exercise.tfng && !exercise.matchingHeadings && !exercise.listeningTrueFalse && !exercise.listeningTable && !exercise.grammarMcq && layout === 'template_e' && (
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
      </div>
    </section>
  );
};
