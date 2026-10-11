import test from 'node:test';
import assert from 'node:assert/strict';

// Import parser directly using Node's experimental type stripping
import { 
  parseWorksheetText, 
  classifyExerciseType, 
  selectLayoutTemplate,
  SAMPLE_SMART_PASTE_TEXT 
} from '../../../flow-bridge-studio/frontend/src/features/worksheet-builder/services/smartPasteParser.ts';

// Test Case 1: Single Multiple Choice exercise
test('Smart Paste Case 1: Single Multiple Choice exercise', () => {
  const input = `Exercise 1: Grammar Multiple Choice
Instructions: Choose the best answer to complete each sentence.
1. She ________ to school every day.
A. go
B. goes
C. going
D. went
2. They ________ playing football now.
A. is
B. are
C. was
D. were`;

  const result = parseWorksheetText(input);
  assert.equal(result.worksheet.exercises.length, 1);
  const ex = result.worksheet.exercises[0];
  assert.equal(ex.type, 'grammar_vocab_multiple_choice');
  assert.equal(ex.questions.length, 2);
  assert.equal(ex.questions[0].options?.length, 4);
  assert.equal(ex.questions[0].options?.[0].label, 'A');
  assert.equal(ex.questions[0].options?.[0].text, 'go');
  assert.equal(ex.layoutType, 'template_a'); // Text Only
});

// Test Case 2: Multiple exercises in one paste
test('Smart Paste Case 2: Multiple exercises in one paste', () => {
  const result = parseWorksheetText(SAMPLE_SMART_PASTE_TEXT);
  assert.ok(result.worksheet.exercises.length >= 4, `Expected at least 4 exercises, got ${result.worksheet.exercises.length}`);
  assert.equal(result.worksheet.title, 'MID-TERM ASSESSMENT - SEMESTER 2');
});

// Test Case 3: Reading passage plus questions
test('Smart Paste Case 3: Reading passage plus questions', () => {
  const input = `Exercise 1: Reading Comprehension
Instructions: Read the passage and answer the questions.
Passage:
Polar bears live in the icy Arctic region where temperatures often drop below minus forty degrees Celsius. Their thick white fur provides camouflage and insulation against freezing blizzards. They primarily hunt seals on sea ice platforms. Due to rising global temperatures, Arctic sea ice is melting earlier each spring, drastically reducing hunting grounds.
1. Where do polar bears live?
2. What do polar bears primarily hunt?`;

  const result = parseWorksheetText(input);
  assert.equal(result.worksheet.exercises.length, 1);
  const ex = result.worksheet.exercises[0];
  assert.ok(ex.passage && ex.passage.length > 50, 'Passage should be extracted');
  assert.ok(ex.passage.includes('Polar bears live in the icy Arctic'));
  assert.equal(ex.questions.length, 2);
  assert.equal(ex.layoutType, 'template_d'); // Two columns for reading
});

// Test Case 4: Matching Pictures with A–E
test('Smart Paste Case 4: Matching Pictures with A–E', () => {
  const input = `Exercise 2: Picture Matching
Instructions: Look at pictures A–E and match each sentence to the picture.
1. The chef is preparing dinner.
2. The mechanic is fixing a truck.
3. The pilot is in the cockpit.
4. The doctor is examining a patient.
5. The firefighter is extinguishing flames.`;

  const result = parseWorksheetText(input);
  const ex = result.worksheet.exercises[0];
  assert.equal(ex.type, 'matching_pictures');
  assert.equal(ex.imageSlots.length, 5, 'Should infer 5 image slots (A-E)');
  assert.equal(ex.imageSlots[0].label, 'A');
  assert.equal(ex.imageSlots[4].label, 'E');
  assert.equal(ex.layoutType, 'template_b'); // Text + Image Grid
});

// Test Case 5: Listening Table Completion
test('Smart Paste Case 5: Listening Table Completion', () => {
  const input = `Exercise 3: Listening Table Completion
Instructions: Listen and complete the table with missing information.
| Day | Activity | Location |
| Monday | Swimming | Sports Centre |
| Wednesday | ________ | Library |
| Friday | Tennis | ________ |
1. What time does swimming start?`;

  const result = parseWorksheetText(input);
  const ex = result.worksheet.exercises[0];
  assert.equal(ex.type, 'listening_table_completion');
  assert.ok(ex.tableData, 'Table data should be extracted');
  assert.equal(ex.tableData.headers.length, 3);
  assert.equal(ex.layoutType, 'template_e'); // Image + Table
});

// Test Case 6: Gap Filling with word bank
test('Smart Paste Case 6: Gap Filling with word bank', () => {
  const input = `Exercise 4: Vocabulary Gap Fill
Instructions: Fill in the gaps using the words from the box.
Word bank: [innovative, sustainable, renewable, ecological]
1. Solar and wind power are forms of ________ energy.
2. The university designed an ________ recycling system.`;

  const result = parseWorksheetText(input);
  const ex = result.worksheet.exercises[0];
  assert.equal(ex.type, 'gap_filling_word_formation');
  assert.equal(ex.questions.length, 2);
  assert.deepEqual(ex.questions[0].wordBank, ['innovative', 'sustainable', 'renewable', 'ecological']);
});

// Test Case 7: Content without answer keys
test('Smart Paste Case 7: Content without answer keys (no fabricated answers)', () => {
  const input = `Exercise 1: Multiple Choice
1. What is the capital of Australia?
A. Sydney
B. Melbourne
C. Canberra
D. Brisbane`;

  const result = parseWorksheetText(input);
  const q = result.worksheet.exercises[0].questions[0];
  assert.equal(q.correctAnswer, undefined, 'Must not fabricate missing answer keys');
});

// Test Case 8: Content containing explicit answer keys
test('Smart Paste Case 8: Content containing explicit answer keys', () => {
  const input = `Exercise 1: Multiple Choice
1. Water freezes at what temperature?
A. 0°C
B. 10°C
C. 50°C
D. 100°C

ANSWER KEY:
1. A`;

  const result = parseWorksheetText(input);
  const q = result.worksheet.exercises[0].questions[0];
  assert.equal(q.correctAnswer, 'A', 'Should extract and map explicit answer key');
});

// Test Case 9: Duplicate question numbering
test('Smart Paste Case 9: Duplicate question numbering creates unique question IDs', () => {
  const input = `Exercise 1: Section One
1. Question first.

Exercise 2: Section Two
1. Question second with same number.`;

  const result = parseWorksheetText(input);
  assert.equal(result.worksheet.exercises.length, 2);
  const q1 = result.worksheet.exercises[0].questions[0];
  const q2 = result.worksheet.exercises[1].questions[0];
  assert.notEqual(q1.id, q2.id, 'Question IDs must be globally unique even if numbers repeat');
});

// Test Case 10: Malformed or ambiguous input
test('Smart Paste Case 10: Malformed or ambiguous input creates fallback with preserved text', () => {
  const input = `Some arbitrary text without standard exercise numbering or tags. Just messy notes.`;
  const result = parseWorksheetText(input);
  assert.ok(result.worksheet.exercises.length >= 1, 'Should create at least 1 fallback exercise');
  assert.ok(result.warnings.length > 0, 'Should register parsing warning');
  assert.equal(result.rawText, input, 'Original raw text must be preserved');
});

// Test Case 11: Long pasted documents
test('Smart Paste Case 11: Long pasted documents parse successfully', () => {
  let longText = `HIGH SCHOOL ENGLISH FINAL EXAM\nTime: 90 mins · Total: 100 pts\n\n`;
  for (let i = 1; i <= 6; i++) {
    longText += `Exercise ${i}: Vocabulary Section ${i}\nInstructions: Choose A, B, C or D.\n`;
    for (let j = 1; j <= 5; j++) {
      const qNum = (i - 1) * 5 + j;
      longText += `${qNum}. Sample question item ${qNum}?\nA. Opt 1\nB. Opt 2\nC. Opt 3\nD. Opt 4\n`;
    }
    longText += `\n`;
  }
  const result = parseWorksheetText(longText);
  assert.equal(result.worksheet.exercises.length, 6);
  assert.equal(result.worksheet.importMetadata?.stats?.detectedQuestions, 30);
});

// Test Case 12: Missing or unsupported sections (preserves original text in importMetadata)
test('Smart Paste Case 12: Unsupported text is retained in importMetadata', () => {
  const input = `Exercise 1: Writing
Instructions: Write an essay of 200 words.
[Audio CD Track 4 unparseable reference]
1. Write about environmental pollution.`;

  const result = parseWorksheetText(input);
  assert.ok(result.worksheet.importMetadata);
  assert.equal(result.worksheet.importMetadata.rawText, input);
});

// Test Case 13: Save and reload after import (validates schema contract)
test('Smart Paste Case 13: Serializes and reloads worksheet without data loss', () => {
  const result = parseWorksheetText(SAMPLE_SMART_PASTE_TEXT);
  const serialized = JSON.stringify(result.worksheet);
  const reloaded = JSON.parse(serialized);

  assert.equal(reloaded.id, result.worksheet.id);
  assert.equal(reloaded.exercises.length, result.worksheet.exercises.length);
  assert.equal(reloaded.printSettings.paperSize, 'A4');
  assert.equal(reloaded.printSettings.marginMm, 15);
});

// Test Case 14: PDF/DOCX export compatibility
test('Smart Paste Case 14: Output conforms to Worksheet export structure', () => {
  const result = parseWorksheetText(SAMPLE_SMART_PASTE_TEXT);
  const ws = result.worksheet;

  // Verify all fields required by exportWorksheetToDocx exist
  assert.ok(ws.title);
  assert.ok(ws.exercises.length > 0);
  for (const ex of ws.exercises) {
    assert.ok(ex.title);
    assert.ok(Array.isArray(ex.questions));
    assert.ok(Array.isArray(ex.imageSlots));
  }
});
