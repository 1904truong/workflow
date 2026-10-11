/**
 * Strict A4 Design Tokens for English Worksheet Builder
 * As specified in ISO A4 standard (210mm x 297mm)
 */

export const PRINT_TOKENS = {
  page: {
    paperSize: 'ISO A4',
    widthMm: 210,
    heightMm: 297,
    orientation: 'portrait',
    marginTopMm: 15,
    marginBottomMm: 15,
    marginLeftMm: 15,
    marginRightMm: 15,
    printableWidthMm: 180,
    printableHeightMm: 267,
    backgroundColor: '#ffffff',
    textColor: '#111111',
  },
  typography: {
    fontFamily: 'Arial, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    lineHeightBody: 1.35,
    lineHeightHeading: 1.2,
    sizesPt: {
      worksheetTitle: 16,
      unitLesson: 9,
      exerciseHeading: 12,
      exerciseInstructions: 10.5,
      readingPassage: 11,
      questionText: 11,
      multipleChoiceOptions: 10.5,
      imageLabels: 10,
      studentInformation: 10,
      footer: 8,
      answerKey: 10,
    },
    weights: {
      bold: 700,
      regular: 400,
      medium: 500,
    },
  },
  borders: {
    table: '0.5pt solid #777777',
    answerBox: '0.5pt solid #777777',
    imagePlaceholder: '0.75pt dashed #999999',
    headerDivider: '0.75pt solid #888888',
    footerDivider: '0.5pt solid #AAAAAA',
    writingLine: '0.5pt solid #888888',
  },
  spacing: {
    titleToStudentInfoMm: 4,
    studentInfoToContentMm: 6,
    exerciseHeadingToContentMm: 3,
    betweenExercisesMm: 5,
    betweenQuestionsMm: 3,
    betweenParagraphsMm: 3,
    imageToLabelMm: 1.5,
    imageGridGapMm: 4,
    tableCellPaddingMm: 2,
    twoColumnGapMm: 5,
  },
  imageSlots: {
    smallMultipleChoice: { widthMm: 48, heightMm: 36, aspectRatio: '4:3' },
    matching: { widthMm: 72, heightMm: 54, aspectRatio: '4:3' },
    readingIllustration: { widthMm: 65, heightMm: 48, aspectRatio: '4:3' },
    largeIllustration: { widthMm: 175, heightMm: 95, aspectRatio: '16:9' },
    wideIllustration: { widthMm: 180, heightMm: 100, aspectRatio: '16:9' },
  },
} as const;
