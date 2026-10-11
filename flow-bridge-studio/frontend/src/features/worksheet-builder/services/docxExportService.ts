import type { Worksheet } from '../types';

/**
 * Generates an editable Microsoft Word document (.doc / .docx compatible HTML format)
 * with ISO A4 sizing, margins, and typography matching the worksheet.
 */
export function exportWorksheetToDocx(worksheet: Worksheet, mode: 'student' | 'teacher_key' = 'student'): void {
  const isTeacher = mode === 'teacher_key';

  const content = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>${escapeXml(worksheet.title)}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page Section1 {
      size: 210mm 297mm; /* ISO A4 */
      margin: 15mm 15mm 15mm 15mm;
      mso-header-margin: 10mm;
      mso-footer-margin: 10mm;
      mso-paper-source: 0;
    }
    div.Section1 {
      page: Section1;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.35;
      color: #111111;
    }
    h1 {
      font-size: 16pt;
      font-weight: bold;
      text-transform: uppercase;
      text-align: center;
      margin: 0 0 4pt 0;
      color: #0f172a;
    }
    .header-sub {
      text-align: center;
      font-size: 10pt;
      color: #475569;
      margin: 0 0 12pt 0;
    }
    .student-box {
      width: 100%;
      border: 1pt solid #cbd5e1;
      padding: 6pt 10pt;
      margin-bottom: 14pt;
      background-color: #f8fafc;
      font-size: 10pt;
    }
    .exercise-title {
      font-size: 12pt;
      font-weight: bold;
      text-transform: uppercase;
      color: #1e293b;
      margin-top: 14pt;
      margin-bottom: 3pt;
      border-bottom: 0.75pt solid #cbd5e1;
      padding-bottom: 2pt;
    }
    .instructions {
      font-size: 10pt;
      font-style: italic;
      color: #334155;
      margin-bottom: 6pt;
    }
    .passage {
      background-color: #f1f5f9;
      border-left: 3pt solid #3b82f6;
      padding: 6pt 10pt;
      margin: 6pt 0 10pt 0;
      font-size: 10.5pt;
    }
    .question {
      margin-bottom: 6pt;
    }
    .question-num {
      font-weight: bold;
    }
    .options {
      margin-left: 14pt;
      margin-top: 3pt;
    }
    .answer-key-badge {
      display: inline-block;
      background-color: #fef2f2;
      color: #dc2626;
      border: 1pt solid #fecaca;
      padding: 2pt 6pt;
      font-weight: bold;
      font-size: 9.5pt;
      margin-left: 8pt;
      border-radius: 3pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8pt 0;
    }
    th, td {
      border: 1pt solid #cbd5e1;
      padding: 5pt 8pt;
      font-size: 10pt;
      text-align: left;
    }
    th {
      background-color: #f1f5f9;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="Section1">
    <!-- Header -->
    <h1>${escapeXml(worksheet.title || 'English Worksheet')}</h1>
    <div class="header-sub">
      ${escapeXml(worksheet.schoolName || 'School Name')} | ${escapeXml(worksheet.unit || 'Unit')} · ${escapeXml(worksheet.lesson || 'Lesson')} | Level: ${escapeXml(worksheet.gradeLevel || 'General')}
    </div>

    <!-- Student Info Box -->
    <table class="student-box">
      <tr>
        <td style="border: none; width: 45%;"><strong>Name:</strong> ___________________________</td>
        <td style="border: none; width: 25%;"><strong>Class:</strong> _______</td>
        <td style="border: none; width: 30%;"><strong>Date:</strong> _______________</td>
      </tr>
      <tr>
        <td style="border: none;" colspan="2"><strong>Teacher:</strong> ${escapeXml(worksheet.teacherName || 'English Teacher')}</td>
        <td style="border: none;"><strong>Time:</strong> ${worksheet.totalTimeMinutes ? `${worksheet.totalTimeMinutes} mins` : '45 mins'} | <strong>Max:</strong> ${worksheet.totalPoints || 10} pts</td>
      </tr>
    </table>

    ${isTeacher ? `
      <div style="background-color: #dc2626; color: white; padding: 4pt 8pt; font-weight: bold; font-size: 11pt; text-align: center; margin-bottom: 12pt;">
        *** TEACHER ANSWER KEY & SCORING GUIDE ***
      </div>
    ` : ''}

    <!-- Exercises -->
    ${worksheet.exercises.map((ex, exIdx) => `
      <div class="exercise-section">
        <div class="exercise-title">
          ${escapeXml(ex.title || `Exercise ${exIdx + 1}`)} ${ex.pointsTotal ? `(${ex.pointsTotal} pts)` : ''}
        </div>
        ${ex.instructions ? `<div class="instructions">${escapeXml(ex.instructions)}</div>` : ''}
        ${ex.passage ? `<div class="passage">${escapeXml(ex.passage).replace(/\n/g, '<br/>')}</div>` : ''}

        <!-- Questions -->
        <div class="questions-list">
          ${ex.questions.map((q, qIdx) => `
            <div class="question">
              <span class="question-num">${q.number || qIdx + 1}.</span> ${escapeXml(q.text)}
              ${isTeacher && q.correctAnswer ? `
                <span class="answer-key-badge">Key: [${escapeXml(String(q.correctAnswer))}]</span>
              ` : ''}

              ${q.options && q.options.length > 0 ? `
                <div class="options">
                  ${q.options.map((opt) => `
                    <div><strong>${escapeXml(opt.label)}.</strong> ${escapeXml(opt.text)} ${isTeacher && q.correctAnswer === opt.label ? '✓' : ''}</div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `).join('')}

    ${isTeacher ? `
      <div style="page-break-before: always; margin-top: 20pt;">
        <h2 style="font-size: 14pt; border-bottom: 1pt solid #000; padding-bottom: 4pt;">MASTER ANSWER SUMMARY</h2>
        <table>
          <thead>
            <tr>
              <th style="width: 15%;">Exercise</th>
              <th style="width: 15%;">Question #</th>
              <th style="width: 40%;">Correct Answer</th>
              <th style="width: 30%;">Points</th>
            </tr>
          </thead>
          <tbody>
            ${worksheet.exercises.flatMap((ex, eIdx) =>
              ex.questions.map((q, qIdx) => `
                <tr>
                  <td>Ex ${eIdx + 1}</td>
                  <td>Q${q.number || qIdx + 1}</td>
                  <td><strong>${escapeXml(String(q.correctAnswer || 'N/A'))}</strong></td>
                  <td>${q.points || 1} pt</td>
                </tr>
              `)
            ).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}
  </div>
</body>
</html>
  `.trim();

  const blob = new Blob(['\ufeff', content], {
    type: 'application/msword;charset=utf-8'
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileName = `${worksheet.title.replace(/\s+/g, '_')}_${isTeacher ? 'TeacherKey' : 'StudentCopy'}.doc`;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
