import type { QuestionItem, ExerciseType } from '../../types';
import { PRINT_TOKENS } from '../../tokens/printTokens';

interface QuestionRendererProps {
  question: QuestionItem;
  exerciseType: ExerciseType;
  index: number;
  isTeacherKey?: boolean;
}

export const QuestionRenderer: React.FC<QuestionRendererProps> = ({
  question,
  exerciseType,
  index,
  isTeacherKey = false,
}) => {
  const qNum = question.number ?? index + 1;

  // Multiple Choice Questions
  if (
    exerciseType === 'grammar_vocab_multiple_choice' ||
    exerciseType === 'reading_multiple_choice' ||
    exerciseType === 'listening_multiple_choice'
  ) {
    return (
      <div className="mb-[3mm] text-[11pt]" style={{ fontFamily: PRINT_TOKENS.typography.fontFamily }}>
        <div className="flex items-start gap-1.5 leading-[1.35]">
          <span className="font-bold min-w-[20px]">{qNum}.</span>
          <div className="flex-1">
            <span>{question.text}</span>
            {isTeacherKey && question.correctAnswer && (
              <span className="ml-2 font-bold text-red-600 text-[10pt]">[ Ans: {question.correctAnswer} ]</span>
            )}
          </div>
        </div>

        {/* Options grid */}
        {question.options && question.options.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-[1.5mm] pl-[20px] text-[10.5pt]">
            {question.options.map((opt) => {
              const isCorrect = isTeacherKey && question.correctAnswer === opt.label;
              return (
                <div
                  key={opt.id}
                  className={`flex items-start gap-1.5 ${
                    isCorrect ? 'font-bold text-red-600 underline' : 'text-[#222222]'
                  }`}
                >
                  <span className="font-semibold">{opt.label}.</span>
                  <span>{opt.text}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // True / False or True / False / Not Given
  if (exerciseType === 'true_false_not_given' || exerciseType === 'listening_true_false') {
    const isTFNG = exerciseType === 'true_false_not_given';
    return (
      <div className="mb-[3mm] text-[11pt] flex items-start justify-between gap-4" style={{ fontFamily: PRINT_TOKENS.typography.fontFamily }}>
        <div className="flex items-start gap-1.5 leading-[1.35] flex-1">
          <span className="font-bold min-w-[20px]">{qNum}.</span>
          <span>{question.text}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0 text-[10pt] font-semibold text-[#444444]">
          {isTFNG ? (
            <>
              {['T', 'F', 'NG'].map((opt) => (
                <span
                  key={opt}
                  className={`px-1.5 py-0.5 border rounded ${
                    isTeacherKey && question.correctAnswer === opt
                      ? 'bg-red-50 border-red-600 text-red-600 font-bold'
                      : 'border-[#888888] text-[#555555]'
                  }`}
                >
                  {opt}
                </span>
              ))}
            </>
          ) : (
            <>
              {['True', 'False'].map((opt) => (
                <span
                  key={opt}
                  className={`px-1.5 py-0.5 border rounded ${
                    isTeacherKey && question.correctAnswer === opt
                      ? 'bg-red-50 border-red-600 text-red-600 font-bold'
                      : 'border-[#888888] text-[#555555]'
                  }`}
                >
                  {opt}
                </span>
              ))}
            </>
          )}
        </div>
      </div>
    );
  }

  // Gap Filling / Word Formation / Listening Fill in Gap
  if (
    exerciseType === 'gap_filling_word_formation' ||
    exerciseType === 'listening_gap_fill'
  ) {
    return (
      <div className="mb-[3mm] text-[11pt]" style={{ fontFamily: PRINT_TOKENS.typography.fontFamily }}>
        <div className="flex items-start gap-1.5 leading-[1.35]">
          <span className="font-bold min-w-[20px]">{qNum}.</span>
          <div className="flex-1">
            <span>{question.text}</span>
            {isTeacherKey && question.correctAnswer ? (
              <span className="ml-2 font-bold text-red-600 underline">
                ({question.correctAnswer})
              </span>
            ) : (
              <span className="inline-block border-b border-[#555555] w-28 ml-2"></span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Sentence Rearrangement
  if (exerciseType === 'sentence_rearrangement') {
    return (
      <div className="mb-[4mm] text-[11pt]" style={{ fontFamily: PRINT_TOKENS.typography.fontFamily }}>
        <div className="flex items-start gap-1.5 leading-[1.35]">
          <span className="font-bold min-w-[20px]">{qNum}.</span>
          <div className="flex-1">
            <span className="italic text-[#333333]">
              {question.mixedWords ? question.mixedWords.join(' / ') : question.text}
            </span>
          </div>
        </div>

        {/* Answer Line */}
        <div className="mt-2 pl-[20px]">
          {isTeacherKey && question.correctAnswer ? (
            <div className="text-red-600 font-semibold text-[10.5pt] border-b border-[#888888] pb-0.5">
              ➔ {question.correctAnswer}
            </div>
          ) : (
            <div className="border-b border-[#888888] h-[18px]"></div>
          )}
        </div>
      </div>
    );
  }

  // Sentence Construction or Short Answer
  if (exerciseType === 'sentence_construction' || exerciseType === 'reading_short_answer') {
    const lines = question.linesCount || 2;
    return (
      <div className="mb-[4mm] text-[11pt]" style={{ fontFamily: PRINT_TOKENS.typography.fontFamily }}>
        <div className="flex items-start gap-1.5 leading-[1.35]">
          <span className="font-bold min-w-[20px]">{qNum}.</span>
          <div className="flex-1">
            <span>{question.text}</span>
            {isTeacherKey && question.correctAnswer && (
              <div className="mt-1 text-red-600 font-bold text-[10pt]">
                Sample Answer: {question.correctAnswer}
              </div>
            )}
          </div>
        </div>

        {/* Ruled lines */}
        {(!isTeacherKey || !question.correctAnswer) && (
          <div className="mt-2 pl-[20px] space-y-3">
            {Array.from({ length: lines }).map((_, lIdx) => (
              <div 
                key={lIdx} 
                className="w-full border-b border-[#888888] h-[16px]"
                style={{ borderBottom: PRINT_TOKENS.borders.writingLine }}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Default / Matching question fallback
  return (
    <div className="mb-[3mm] text-[11pt] flex items-start gap-1.5" style={{ fontFamily: PRINT_TOKENS.typography.fontFamily }}>
      <span className="font-bold min-w-[20px]">{qNum}.</span>
      <div className="flex-1">
        <span>{question.text}</span>
        {isTeacherKey && question.correctAnswer && (
          <span className="ml-2 font-bold text-red-600">[ {question.correctAnswer} ]</span>
        )}
      </div>
    </div>
  );
};
