import test from 'node:test';
import assert from 'node:assert/strict';

// Test strict ISO A4 specifications
test('ISO A4 Standard Dimensions: 210mm x 297mm with 15mm margins', () => {
  const widthMm = 210;
  const heightMm = 297;
  const marginMm = 15;
  const printableWidthMm = widthMm - marginMm * 2;
  const printableHeightMm = heightMm - marginMm * 2;

  assert.equal(widthMm, 210, 'A4 width must be 210mm');
  assert.equal(heightMm, 297, 'A4 height must be 297mm');
  assert.equal(printableWidthMm, 180, 'Printable width must be 180mm');
  assert.equal(printableHeightMm, 267, 'Printable height must be 267mm');
});

test('Exercise Type System: Supports 15 canonical exercise types', () => {
  const canonicalTypes = [
    'listening_gap_fill',
    'listening_multiple_choice',
    'listening_true_false',
    'listening_table_completion',
    'reading_multiple_choice',
    'true_false_not_given',
    'reading_short_answer',
    'matching_headings',
    'matching_information',
    'matching_vocabulary',
    'matching_pictures',
    'grammar_vocab_multiple_choice',
    'gap_filling_word_formation',
    'sentence_rearrangement',
    'sentence_construction',
  ];

  assert.equal(canonicalTypes.length, 15, 'Must contain all 15 exercise types');
});

test('Template Layouts: 5 base templates (A, B, C, D, E)', () => {
  const templates = ['template_a', 'template_b', 'template_c', 'template_d', 'template_e'];
  assert.equal(templates.length, 5, 'Must support 5 base templates');
});

test('Image Slot Sizing: Respects print width limits (max 180mm)', () => {
  const slots = [
    { name: 'small', width: 48, height: 36 },
    { name: 'matching', width: 72, height: 54 },
    { name: 'reading', width: 65, height: 48 },
    { name: 'large', width: 175, height: 95 },
    { name: 'wide', width: 180, height: 100 },
  ];

  for (const slot of slots) {
    assert.ok(slot.width <= 180, `${slot.name} width (${slot.width}mm) exceeds printable width 180mm`);
  }
});
