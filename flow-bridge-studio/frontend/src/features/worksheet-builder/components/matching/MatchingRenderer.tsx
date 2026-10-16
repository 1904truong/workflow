import type { MatchingData } from '../../services/matching/matchingCore';
import { TwoColumnsLayout } from './layouts/TwoColumnsLayout';
import { ConnectLinesLayout } from './layouts/ConnectLinesLayout';
import { AnswerTableLayout } from './layouts/AnswerTableLayout';
import { InlineAnswerLayout } from './layouts/InlineAnswerLayout';
import { CutPasteLayout } from './layouts/CutPasteLayout';
import { ImageMatchingLayout } from './layouts/ImageMatchingLayout';
import { ReadingImagesLayout } from './layouts/ReadingImagesLayout';

/** Một bộ dữ liệu, sáu cách trình bày: đổi layout không đụng tới nội dung hay đáp án. */
export const MatchingRenderer = ({ data }: { data: MatchingData }) => {
  const props = { data };
  switch (data.layout) {
    case 'connect_lines': return <ConnectLinesLayout {...props} />;
    case 'answer_table': return <AnswerTableLayout {...props} />;
    case 'inline_answer': return <InlineAnswerLayout {...props} />;
    case 'cut_paste': return <CutPasteLayout {...props} />;
    case 'image_matching': return <ImageMatchingLayout {...props} />;
    case 'reading_images': return <ReadingImagesLayout {...props} />;
    case 'two_columns':
    default: return <TwoColumnsLayout {...props} />;
  }
};
