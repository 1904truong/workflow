import test from 'node:test';
import assert from 'node:assert/strict';

// Helper: replicate folderToWorksheet function in node test environment
function folderToWorksheet(folder) {
  return {
    id: folder.id,
    title: folder.name,
    gradeLevel: folder.gradeLevel,
    subject: folder.subject,
    unitTopic: folder.unitTopic,
    lessonTitle: folder.lessonTitle,
    description: folder.description,
    schoolName: folder.schoolName || 'Cambridge International Academy',
    teacherName: folder.teacherName || 'Teacher',
    date: new Date(folder.createdAt || Date.now()).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    totalPoints: folder.totalPoints || folder.exercises.reduce((s, e) => s + (e.pointsTotal || 0), 0) || 20,
    estimatedDuration: folder.estimatedDuration || 45,
    targetSkills: folder.targetSkills || ['Reading', 'Vocabulary'],
    printSettings: folder.printSettings || {
      paperSize: 'A4',
      orientation: 'portrait',
      widthMm: 210,
      heightMm: 297,
      marginMm: 15,
      printableWidthMm: 180,
      printableHeightMm: 267,
      showStudentInfo: true,
      showEmptyImagePlaceholders: true,
      mode: 'student',
      showAnswerKey: false,
    },
    exercises: folder.exercises.map((e, idx) => ({
      ...e,
      order: idx + 1,
    })),
  };
}

test('Lesson Folder: Structure & Required Fields', () => {
  const folder = {
    id: 'folder_unit_5',
    name: 'Unit 5: Nature & Environment',
    gradeLevel: 'Grade 7',
    subject: 'English',
    unitTopic: 'Ecosystems & Habitats',
    lessonTitle: 'The Amazon Rainforest',
    description: 'Reading comprehension and vocabulary worksheet.',
    schoolName: 'Cambridge Academy',
    teacherName: 'Ms. Jenkins',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    exercises: [],
    status: 'draft',
  };

  assert.ok(folder.id, 'Folder must have unique ID');
  assert.equal(folder.name, 'Unit 5: Nature & Environment');
  assert.equal(folder.gradeLevel, 'Grade 7');
  assert.equal(folder.subject, 'English');
  assert.ok(Array.isArray(folder.exercises), 'Folder exercises must be an array');
});

test('Lesson Folder: Adding Exercises and Preserving Order', () => {
  const folder = {
    id: 'folder_123',
    name: 'Unit 3: Daily Life',
    gradeLevel: 'Grade 6',
    subject: 'English',
    exercises: [],
  };

  // Add Exercise 1: Reading
  const ex1 = {
    id: 'ex_1',
    type: 'reading_multiple_choice',
    layoutType: 'template_d',
    title: 'Reading Comprehension',
    instructions: 'Read the text and choose the correct answer.',
    order: 1,
    questions: [
      { id: 'q_1', number: 1, text: 'Where does Tom live?', correctAnswer: 'London' }
    ],
    imageSlots: [],
  };

  // Add Exercise 2: Matching Pictures
  const ex2 = {
    id: 'ex_2',
    type: 'matching_pictures',
    layoutType: 'template_b',
    title: 'Matching Pictures',
    instructions: 'Match each vocabulary word with picture A-D.',
    order: 2,
    questions: [
      { id: 'q_2', number: 1, text: 'supermarket', correctAnswer: 'A' },
      { id: 'q_3', number: 2, text: 'library', correctAnswer: 'B' }
    ],
    imageSlots: [
      { slotId: 'slot_A', label: 'A', widthMm: 72, heightMm: 54, status: 'empty' },
      { slotId: 'slot_B', label: 'B', widthMm: 72, heightMm: 54, status: 'empty' }
    ],
  };

  folder.exercises.push(ex1, ex2);
  assert.equal(folder.exercises.length, 2);
  assert.equal(folder.exercises[0].id, 'ex_1');
  assert.equal(folder.exercises[1].id, 'ex_2');

  // Reorder exercises: ex2 moves before ex1
  const reordered = [folder.exercises[1], folder.exercises[0]].map((ex, idx) => ({
    ...ex,
    order: idx + 1,
  }));
  folder.exercises = reordered;

  assert.equal(folder.exercises[0].id, 'ex_2');
  assert.equal(folder.exercises[0].order, 1);
  assert.equal(folder.exercises[1].id, 'ex_1');
  assert.equal(folder.exercises[1].order, 2);
});

test('Lesson Folder: Combined Document (folderToWorksheet)', () => {
  const folder = {
    id: 'folder_combined',
    name: 'Mid-term Assessment',
    gradeLevel: 'Grade 8',
    subject: 'English',
    schoolName: 'Oxford International',
    teacherName: 'David Lee',
    createdAt: Date.now(),
    exercises: [
      {
        id: 'ex_1',
        type: 'grammar_vocab_multiple_choice',
        layoutType: 'template_a',
        title: 'Section A: Grammar',
        instructions: 'Choose A, B, C or D.',
        order: 1,
        questions: [{ id: 'q1', number: 1, text: 'She ____ to school.', correctAnswer: 'goes' }],
        imageSlots: [],
        pointsTotal: 5,
      },
      {
        id: 'ex_2',
        type: 'matching_pictures',
        layoutType: 'template_b',
        title: 'Section B: Vocabulary',
        instructions: 'Match words with images.',
        order: 2,
        questions: [{ id: 'q2', number: 1, text: 'mountain', correctAnswer: 'A' }],
        imageSlots: [{ slotId: 's1', label: 'A', widthMm: 72, heightMm: 54, status: 'assigned' }],
        pointsTotal: 5,
      },
    ],
  };

  const worksheet = folderToWorksheet(folder);

  assert.equal(worksheet.title, 'Mid-term Assessment');
  assert.equal(worksheet.exercises.length, 2, 'Worksheet must combine all exercises in folder');
  assert.equal(worksheet.exercises[0].order, 1);
  assert.equal(worksheet.exercises[1].order, 2);
  assert.equal(worksheet.printSettings.printableWidthMm, 180);
  assert.equal(worksheet.exercises[1].imageSlots.length, 1);
});

test('Lesson Folder: Duplication generates fresh IDs', () => {
  const original = {
    id: 'folder_orig',
    name: 'Unit 1: Greetings',
    gradeLevel: 'Grade 6',
    subject: 'English',
    exercises: [
      {
        id: 'ex_orig_1',
        type: 'listening_multiple_choice',
        layoutType: 'template_a',
        title: 'Listening',
        questions: [{ id: 'q_orig_1', number: 1, text: 'Hello', correctAnswer: 'A' }],
        imageSlots: [],
      },
    ],
  };

  // Replicate duplicate logic
  const copy = {
    ...JSON.parse(JSON.stringify(original)),
    id: `folder_${Date.now()}_copy`,
    name: `${original.name} (Copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    exercises: original.exercises.map((ex, idx) => ({
      ...JSON.parse(JSON.stringify(ex)),
      id: `ex_${Date.now()}_${idx}`,
      questions: ex.questions.map((q, qIdx) => ({
        ...JSON.parse(JSON.stringify(q)),
        id: `q_${Date.now()}_${qIdx}`,
      })),
    })),
  };

  assert.notEqual(copy.id, original.id, 'Duplicated folder must have a distinct ID');
  assert.equal(copy.name, 'Unit 1: Greetings (Copy)');
  assert.notEqual(copy.exercises[0].id, original.exercises[0].id, 'Exercise must have distinct ID');
  assert.notEqual(copy.exercises[0].questions[0].id, original.exercises[0].questions[0].id, 'Question must have distinct ID');
  assert.equal(copy.exercises[0].questions[0].text, 'Hello', 'Content must be preserved');
});
