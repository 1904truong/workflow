# MASTER PROMPT — BUILD COMPLETE ENGLISH WORKSHEET BUILDER

## ROLE

You are a Senior Full-Stack Software Engineer, React Architect, Supabase Database Engineer, Print Layout Specialist, and QA Automation Engineer.

Your task is to inspect the existing application and implement a complete, production-oriented **English Worksheet Builder System**.

This is a real application, not a UI prototype.

Every button, form, workflow, database operation, image placeholder, preview, and export feature must work.

**Existing Technology:**
- React
- TypeScript where supported by the existing codebase
- Supabase PostgreSQL
- Supabase Authentication
- Supabase Storage
- Chrome Extension integration in a later phase

Use existing project conventions and dependencies wherever practical.

Do not unnecessarily rebuild the existing application.

---

# 1. PROJECT OBJECTIVE

Build a professional worksheet creation system for English teachers.

The teacher should be able to:

1. Create a worksheet.
2. Select an English exercise type.
3. Enter exercise instructions, paragraphs, questions, choices, and correct answers.
4. Automatically render the content using a predefined printable template.
5. Have the system reserve the appropriate number of image placeholders.
6. Preview the worksheet as an actual A4 document.
7. Upload an image manually into any placeholder.
8. Replace or remove an image without breaking the layout.
9. Save drafts to Supabase.
10. Export a printable PDF.
11. Export an editable Word document.
12. Export a separate teacher answer key.
13. Reopen and edit existing worksheets.

The teacher must not need to manually position text boxes, drag images around, or adjust font sizes.

## CORE PRINCIPLE

**CONTENT → TEMPLATE → IMAGE SLOTS → IMAGES → PRINTABLE DOCUMENT**

The layout must be determined by the predefined template, not by generated image dimensions.

Google Flow will generate the images in a future integration phase.

The Worksheet Builder must work completely without Google Flow.

---

# 2. FIRST TASK — INSPECT EXISTING SOURCE CODE

Before writing code:

1. Analyze the current folder structure.
2. Identify the React framework and build tool.
3. Inspect existing routes and layouts.
4. Inspect authentication and authorization.
5. Inspect Supabase client configuration.
6. Inspect current database migrations and tables.
7. Identify existing exercise creation and editing functionality.
8. Identify reusable components.
9. Identify existing PDF/DOCX export libraries.
10. Check existing styling conventions.
11. Check for unsaved changes and potential integration conflicts.

Do not delete existing components, routes, database tables, or functionality.

Do not overwrite existing data.

Do not replace the current authentication system.

Create an implementation plan based on the actual codebase before proceeding.

If you cannot access the database or required credentials, report the blocker and continue only with tasks that can be implemented and tested safely.

---

# 3. PRINT DESIGN SYSTEM — STRICT A4 STANDARD

All worksheets must use consistent print dimensions.

## Page Configuration

| Property | Required Value |
|---|---|
| Paper size | ISO A4 |
| Width | 210 mm |
| Height | 297 mm |
| Orientation | Portrait |
| Top margin | 15 mm |
| Bottom margin | 15 mm |
| Left margin | 15 mm |
| Right margin | 15 mm |
| Printable content width | 180 mm |
| Printable content height | 267 mm |
| Page background | Pure white |
| Text color | #111111 |

Use millimeters for physical layout dimensions and points for font sizes and border widths.

Do not use browser viewport dimensions as the source of truth for printed page geometry.

## Typography

Use Arial as the default font.

| Element | Size | Weight |
|---|---|---|
| Worksheet main title | 16 pt | Bold |
| Unit/Lesson label | 9 pt | Regular |
| Exercise heading | 12 pt | Bold |
| Exercise instructions | 10.5 pt | Regular |
| Reading passage | 11 pt | Regular |
| Question text | 11 pt | Regular |
| Multiple-choice options | 10.5 pt | Regular |
| Image labels A/B/C | 10 pt | Bold |
| Student information | 10 pt | Regular |
| Footer | 8 pt | Regular |
| Answer key | 10 pt | Regular |

Typography rules:

- Body line height: 1.35.
- Heading line height: 1.2.
- Avoid excessive letter spacing.
- Maintain consistent alignment.
- Never automatically shrink text to fit.
- Never replace missing content with generated text.
- Preserve teacher-entered punctuation and paragraph breaks.
- Allow natural text wrapping.
- Support long English words without overflowing page boundaries.

## Border System

| Element | Border |
|---|---|
| Table | 0.5 pt solid #777777 |
| Answer box | 0.5 pt solid #777777 |
| Image placeholder | 0.75 pt dashed #999999 |
| Header divider | 0.75 pt solid #888888 |
| Footer divider | 0.5 pt solid #AAAAAA |
| Writing line | 0.5 pt solid #888888 |

Empty image placeholder borders must not appear in the final Student PDF unless the teacher explicitly chooses to print empty image boxes.

Do not use thick decorative borders throughout the worksheet.

## Spacing

- Worksheet title to student information: 4 mm.
- Student information to exercise content: 6 mm.
- Exercise heading to content: 3 mm.
- Between exercises: 5 mm.
- Between questions: 3 mm.
- Between paragraphs: 3 mm.
- Between image and image label: 1.5 mm.
- Image grid horizontal and vertical gap: 4 mm.
- Table cell padding: 2 mm.

Do not add arbitrary margins in individual components.

Use centralized design tokens.

---

# 4. CREATE REUSABLE WORKSHEET COMPONENTS

Implement the following components:

- WorksheetPage
- WorksheetHeader
- WorksheetFooter
- WorksheetRenderer
- ExerciseBlock
- ExerciseHeading
- InstructionsBlock
- ReadingPassage
- QuestionList
- MultipleChoiceQuestion
- FillBlankQuestion
- MatchingQuestion
- TrueFalseQuestion
- ShortAnswerQuestion
- SentenceRearrangementQuestion
- AnswerLine
- AnswerBox
- ImageSlot
- ImageGrid
- ImageWithText
- WorksheetTable
- WorksheetPreview
- PageNavigator
- PrintSettingsPanel
- ExportDialog

Each component must support predictable A4 layout and printing.

Separate editable teacher interfaces from printable output components.

Do not put admin buttons, editing controls, upload icons, or interactive input fields inside the printed worksheet renderer.

---

# 5. EXERCISE TYPE SYSTEM

The source worksheet collection contains 15 exercise types.

Support these exercise types through reusable layouts and data schemas.

## Type 1: Listening Fill in the Gap

Teacher enters:
- Instructions
- Full listening passage or sentences
- Blank positions
- Correct answers
- Optional audio
- Optional image

Student worksheet:
- Instructions
- Passage with answer blanks
- Optional image

## Type 2: Listening Multiple Choice

Teacher enters:
- Questions
- Choices
- Correct answers
- Optional audio
- Optional images

Support text-only choices and image-based choices.

## Type 3: Listening True/False

Teacher enters statements and the correct True/False answers.

Render statements with answer spaces.

## Type 4: Listening Table Completion

Teacher enters:
- Table headers
- Rows
- Fixed text cells
- Blank answer cells
- Correct answers

The table must adapt to A4 width without changing the standard font size.

## Type 5: Reading Multiple Choice

Teacher enters:
- Reading passage
- Questions
- Choices
- Correct answers

The reading passage must remain editable and selectable in exported documents.

## Type 6: True/False/Not Given

Render each statement with three response options:

T / F / NG

Correct answers must be stored separately.

## Type 7: Reading Short Answer

Teacher enters a reading passage and questions.

Render an appropriate number of writing lines.

## Type 8: Matching Headings / Main Ideas

Teacher enters paragraphs and headings.

Render a matching list with answer boxes.

## Type 9: Matching Information

Teacher enters two groups of related information.

Render both groups in aligned columns or a clearly structured list.

## Type 10: Matching Vocabulary

Teacher enters vocabulary and definitions.

Render them in separate columns.

## Type 11: Matching Pictures

Teacher enters:
- Instructions
- Paragraphs or statements
- Matching options
- Correct answers
- Image count

Automatically create image placeholders.

Example: 5 matching pictures must result in 5 reserved image slots.

## Type 12: Grammar & Vocabulary Multiple Choice

Render grammar questions with A/B/C/D choices.

Support 2, 3, 4, or more choices without layout overlap.

## Type 13: Gap Filling / Word Formation

Support:
- Missing words
- Verb forms
- Word forms
- Prepositions
- Word banks
- Teacher-defined accepted answers

## Type 14: Sentence Rearrangement

Teacher enters mixed-order words.

Render the mixed words followed by an appropriate answer line.

## Type 15: Sentence Construction

Teacher enters suggested words or phrases.

Render the prompt followed by writing lines.

Use shared question schemas where possible, rather than implementing 15 unrelated systems.

---

# 6. FIVE BASE LAYOUT TEMPLATES

Create five main printable layouts.

## Template A — Text Only

For grammar, vocabulary, gap filling, sentence construction, and writing exercises.

No image required.

## Template B — Text + Image Grid

For matching pictures and image multiple-choice.

Supports:
- 2 images
- 3 images
- 4 images
- 5 images
- 6 images
- Custom image counts

Display images using a configurable grid.

## Template C — Text + Single Image

For reading passages and illustrated exercises.

Allow image placement:
- Top
- Left
- Right
- Bottom

## Template D — Two-Column

For reading + questions or matching information.

Both columns must fit inside the 180 mm printable content width.

Column gap: 5 mm.

## Template E — Image + Table

For listening table completion, map exercises, and structured information tasks.

Use a properly sized image slot with a separate table.

Every template must use the same global A4 typography and spacing tokens.

---

# 7. IMAGE SLOT SYSTEM — CRITICAL

The image placeholder system is one of the most important parts of this project.

Images must not be positioned manually using arbitrary coordinates.

Each image placeholder must have a stable unique identifier.

Example:

```json
{
  "slotId": "picture_a",
  "exerciseId": "exercise-id",
  "type": "matching_picture",
  "widthMm": 72,
  "heightMm": 54,
  "aspectRatio": "4:3",
  "assetId": null,
  "status": "empty"
}
```

Use UUID-backed database identifiers where appropriate and readable slot keys for document rendering.

## Standard Image Slot Sizes

| Image Type | Width | Height |
|---|---|---|
| Small multiple-choice image | 48 mm | 36 mm |
| Matching image | 72 mm | 54 mm |
| Reading illustration | 65 mm | 48 mm |
| Large illustration | 175 mm | 95 mm |
| Wide illustration | 180 mm | 100 mm |

These are preferred sizes, not instructions to exceed the available column width.

If two 72 mm images fit within a 180 mm content width, center the grid and distribute spacing consistently.

For three columns, use appropriately smaller image slots.

## Image Behavior

When an image is assigned:

1. Find the target slot by `slotId`.
2. Retrieve the image asset.
3. Insert the image into the slot.
4. Preserve the slot dimensions.
5. Preserve the aspect ratio.
6. Do not stretch the image.
7. Do not change surrounding text positions.
8. Re-render the preview.
9. Save the assignment.
10. Make sure the same result appears in PDF/DOCX.

Use `object-fit: contain` as the default.

If the teacher selects `cover`, indicate that cropping may occur.

Do not crop important subjects automatically.

Image slots must support:
- Upload
- Preview
- Replace
- Remove
- Regenerate integration point
- Image caption
- Aspect ratio
- Optional crop behavior

Images should be validated for print resolution.

Target: 300 DPI.

Example: a 72 × 54 mm image should ideally be at least approximately 850 × 638 pixels.

If resolution is insufficient, show a warning rather than silently enlarging it.

---

# 8. IMAGE GENERATION PREPARATION

Do not implement Google Flow automation yet.

However, prepare the architecture for future automatic generation.

Create a separate Image Generation Service interface.

```typescript
interface ImageGenerationService {
  createImageJob(input: {
    exerciseId: string;
    slotId: string;
    prompt: string;
    aspectRatio: string;
  }): Promise<string>;

  getJobStatus(jobId: string): Promise<string>;

  assignGeneratedImage(
    slotId: string,
    assetId: string
  ): Promise<void>;
}
```

The teacher should eventually be able to click Generate Images.

The future workflow will be:

1. Read worksheet content.
2. Identify image requirements.
3. Create prompts.
4. Send image jobs to Chrome Extension.
5. Chrome Extension interacts with Google Flow.
6. Retrieve the generated image.
7. Upload the image into Supabase Storage.
8. Link the image asset to its image slot.
9. Update worksheet preview.
10. Export final document.

For this implementation, manually uploaded images must work completely.

Do not simulate successful AI image generation.

Do not create fake image jobs that pretend to have contacted Google Flow.

---

# 9. TEACHER WORKSHEET EDITOR UI

Build a professional desktop-friendly editor.

## Layout

Use three logical sections.

### LEFT SIDEBAR — Worksheet Structure

Display:
- Worksheet title
- Exercise list
- Exercise type
- Add exercise
- Duplicate exercise
- Delete exercise
- Reorder exercises

### CENTER — Content Editor

Teacher can edit:
- Exercise title
- Instructions
- Paragraph content
- Questions
- Options
- Answer keys
- Number of image slots
- Image position
- Table content

Inputs must be connected to actual React state and persisted appropriately.

### RIGHT PANEL — A4 Preview

Display the worksheet as pages with realistic A4 proportions.

Updates should be reflected in the preview.

Support:
- Page navigation
- Zoom
- Show page boundaries
- Toggle empty image placeholders
- Student version / Answer key version

The preview must use the same document model as the export system.

Do not build a completely different layout for preview and PDF.

---

# 10. DYNAMIC PAGE BREAKS

Implement page-aware rendering.

Critical requirements:

- A4 page size must be respected.
- Page content must never extend beyond printable bounds.
- Do not cut images across pages.
- Do not split small questions in half.
- Keep questions and their answer choices together whenever possible.
- Move entire blocks to the next page if needed.
- Allow long reading passages to split across pages at appropriate text boundaries.
- Repeat worksheet header information as configured.
- Generate correct page numbers.

Handle:
- Very long paragraphs
- Large tables
- Multiple images
- Many questions
- Different font wrapping
- Empty image slots
- Multi-page worksheets

Do not solve overflow by shrinking the entire page or reducing font sizes.

A single oversized block must be split sensibly rather than creating infinite pages or clipping content.

---

# 11. PRINT PREVIEW AND EXPORT

## PDF Export

Implement PDF export using a reliable printing mechanism.

Prefer Playwright or Puppeteer in a controlled server environment when compatible with the existing project.

Use real A4 dimensions.

Requirements:
- Accurate margins
- Crisp selectable text
- Proper embedded images
- Correct page breaks
- Consistent fonts
- No UI controls
- No browser-generated extra headers or footers
- No clipped text
- No misplaced image slots

Wait for all fonts and images to load before generating the PDF.

## DOCX Export

Implement native DOCX generation using a library such as `docx`.

Do not use an image screenshot of the worksheet as the Word document.

The Word export must preserve editable:
- Titles
- Paragraphs
- Questions
- Tables
- Answer lines
- Images

Apply page dimensions, margins, font sizes and image dimensions using proper Word document units.

Because Word and browser engines use different layout systems, validate both exports independently.

## Export Options

Provide:
- Student PDF
- Teacher Answer Key PDF
- Student DOCX
- Teacher Answer Key DOCX

Support configurable filenames.

Example:

`Unit1_Lesson1_Student.pdf`

`Unit1_Lesson1_AnswerKey.pdf`

---

# 12. SUPABASE DATABASE DESIGN

Inspect the existing schema before adding tables.

Reuse existing exercise tables when safe and appropriate.

Proposed entities:

### worksheets
- id
- teacher_id
- title
- unit
- lesson
- level
- status
- print_settings
- created_at
- updated_at

### worksheet_exercises
- id
- worksheet_id
- exercise_type
- layout_type
- title
- instructions
- content
- position

### worksheet_questions
- id
- exercise_id
- question_type
- question_data
- position

### worksheet_answer_keys
- id
- question_id
- answer_data

### worksheet_image_slots
- id
- exercise_id
- slot_key
- width_mm
- height_mm
- aspect_ratio
- asset_id
- position
- display_settings

### worksheet_image_assets
- id
- owner_id
- storage_path
- mime_type
- width_px
- height_px
- created_at

Use PostgreSQL constraints, foreign keys, indexes and appropriate cascade behavior.

Use `jsonb` for variable exercise-specific content where appropriate.

Keep answer keys separate from student-visible content.

Implement Row Level Security.

Teachers must only access worksheets they are authorized to manage.

Students must not receive correct answers before the appropriate grading or release stage.

Never expose Supabase service role credentials in frontend code.

---

# 13. AUTOSAVE AND EDITING

Implement a reliable editing workflow.

Requirements:
- Save draft
- Debounced autosave
- Manual save
- Visible save status
- Error recovery
- Unsaved changes warning
- Reload existing worksheet
- Duplicate worksheet
- Delete worksheet with confirmation

Do not lose teacher-entered text while typing.

Do not overwrite newer data with stale responses.

Handle Supabase connection failures gracefully.

Use optimistic updates carefully.

---

# 14. VALIDATION RULES

Before publishing or exporting, validate the worksheet.

Examples:

- Worksheet title is present.
- Every question has required content.
- Multiple-choice questions have valid options.
- Answer keys are valid.
- Matching references point to existing entries.
- Image assets belong to valid image slots.
- Tables have valid column structures.
- Images are fully loaded.
- Page overflow is not present.

Allow draft saving even when the worksheet is incomplete.

Separate draft validation from publish validation.

If required images are missing, show the affected slots and let the teacher decide whether to fix them or export a text-only draft with a clear warning.

---

# 15. TESTING REQUIREMENTS

Test all major workflows.

## Unit Tests

Cover:
- Exercise schemas
- Question validation
- Answer key serialization
- Template selection
- Image slot generation
- Image slot assignment
- Page dimension calculations

## Integration Tests

Cover:
- Worksheet creation
- Worksheet editing
- Supabase persistence
- Image upload
- Image replacement
- Reopening a saved worksheet
- Student/teacher export mode

## End-to-End Tests

Use Playwright if appropriate.

Test:
1. Teacher creates worksheet.
2. Teacher chooses Matching Pictures.
3. Teacher creates five questions.
4. System creates five image slots.
5. Teacher uploads five images.
6. Preview displays all five correctly.
7. Teacher exports Student PDF.
8. Teacher exports Answer Key PDF.
9. Teacher exports DOCX.
10. Teacher reopens the worksheet.
11. All content and image assignments remain correct.

## Print Regression Tests

Test documents with:
- One page
- Two pages
- Five or more pages
- Long reading passages
- Multiple image grids
- Tables
- No images
- Missing images
- Large images
- Very long questions

Check actual PDF page dimensions and verify there is no clipping.

Use isolated test data and storage locations.

Never reset or delete production tables to run tests.

Never run destructive migrations without explicit approval.

---

# 16. DEVELOPMENT PHASES

Implement the project in the following order.

## PHASE 1 — Codebase Audit

Inspect the current project and identify integration points.

Output:
- Current architecture
- Relevant existing components
- Proposed changes
- Risks
- Implementation plan

## PHASE 2 — Data Models and Print Tokens

Implement:
- Types
- Zod schemas if appropriate
- Print settings
- Worksheet data model
- Template registry
- Supabase migration plan

## PHASE 3 — Worksheet Templates

Implement:
- Five base layouts
- Fifteen exercise types
- Question renderers
- Image placeholders
- Headers and footers

## PHASE 4 — Teacher Editor

Implement:
- Worksheet creation
- Exercise management
- Content editing
- Answer management
- A4 live preview

## PHASE 5 — Image Slot Management

Implement:
- Manual image upload
- Supabase Storage
- Slot assignment
- Image preview
- Replace/remove image
- Image resolution checks

## PHASE 6 — Export

Implement:
- PDF export
- DOCX export
- Student copy
- Teacher answer key
- Multi-page layout

## PHASE 7 — Verification

Run:
- TypeScript checks
- Lint
- Unit tests
- Integration tests
- End-to-end tests
- PDF page size checks
- Print regression checks

Fix discovered issues and rerun relevant tests.

---

# 17. NON-NEGOTIABLE ENGINEERING REQUIREMENTS

Do not implement decorative buttons with no functionality.

Do not create mock components and claim they are complete.

Do not mark a task as working unless it has been exercised or tested.

Do not invent Supabase table names without inspecting the existing project.

Do not recreate an existing working feature unnecessarily.

Do not modify unrelated pages.

Do not silently alter the current user authentication flow.

Do not make destructive database changes.

Do not use screenshots as the primary PDF or DOCX export mechanism.

Do not use viewport pixels as the source of truth for A4 dimensions.

Do not hardcode content from the sample English PDF.

Do not depend on Google Flow for basic worksheet editing or exporting.

Do not allow content or images to overflow the printable page.

Do not make production deployment changes without approval.

If the task is too large for one execution session, complete one phase properly and report the remaining work rather than claiming full completion.

---

# 18. FINAL ACCEPTANCE CRITERIA

The feature is complete only when:

- A teacher can create a new worksheet.
- The teacher can add and manage different exercise types.
- The teacher can enter all content and correct answers.
- The correct template is rendered automatically.
- The correct number of image placeholders is created.
- The teacher can upload and replace images.
- The teacher can preview a real A4 worksheet.
- The teacher can save and reopen the worksheet.
- The teacher can export an accurate PDF.
- The teacher can export an editable DOCX.
- Student and Teacher Answer Key versions work.
- No page clipping or image distortion occurs in tested cases.
- The existing application continues to work.
- All relevant tests pass.

---

# 19. REQUIRED FINAL REPORT

After implementation, provide:

1. Architecture summary.
2. Files created.
3. Files modified.
4. Database migrations created or applied.
5. Exercise types implemented.
6. Template layouts implemented.
7. Image slot system status.
8. PDF export status.
9. DOCX export status.
10. Tests executed and results.
11. Known limitations.
12. Remaining steps for Google Flow integration.

Do not claim 100% correctness.

Report only verified results.

---

# START IMPLEMENTATION

Begin by inspecting the actual React application, Supabase configuration, existing exercise management components, database schema and export functionality.

Then implement the worksheet builder phase by phase.

Prioritize a working, printable A4 worksheet system with reliable image placeholders, correct page dimensions, persistent data and functional PDF/DOCX export.

**The final system must let teachers focus on entering educational content while the software handles page layout and document formatting automatically.**