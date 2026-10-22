import { passageParagraphs } from './gap-filling/gapFillingCore';
import type { Worksheet } from '../types';
import { listeningPassageHtml } from './listening/listeningDocx';

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
        ${ex.listeningGapFill ? listeningPassageHtml(ex.listeningGapFill, escapeXml) : ex.passage ? `<div class="passage">${escapeXml(ex.passage).replace(/\n/g, '<br/>')}</div>` : ''}

        <!-- Questions -->
        ${ex.cloze ? `
          <table style="width: 100%; border-collapse: collapse; margin-top: 8pt; margin-bottom: 8pt;">
            ${ex.questions.map((q, qIdx) => `
              <tr>
                <td style="border: none; width: 32pt; font-weight: bold; padding: 3pt 0; vertical-align: middle;">
                  ${q.number || qIdx + 1}.
                </td>
                <td style="border: none; padding: 3pt 0; vertical-align: middle;">
                  ${(q.options || []).map(opt => `
                    <span style="display: inline-block; min-width: 120pt; margin-right: 16pt;">
                      <strong>${escapeXml(opt.label)}.</strong> ${escapeXml(opt.text)}
                      ${isTeacher && (q.correctAnswer === opt.label || q.correctAnswer === opt.label.toUpperCase()) ? ' <span style="color: #2563eb; font-weight: bold;">✓</span>' : ''}
                    </span>
                  `).join('')}
                </td>
              </tr>
            `).join('')}
          </table>
        ` : ex.listeningGapFill ? `
          <div style="margin-top: 8pt; margin-bottom: 8pt;">
            ${isTeacher ? `
              <div style="background-color: #eff6ff; border: 1pt solid #bfdbfe; padding: 6pt 10pt; margin-top: 8pt;">
                <strong style="color: #1e40af; font-size: 10pt;">ANSWER KEY:</strong>
                <table style="width: 100%; border: none; margin-top: 4pt;">
                  <tr>
                    ${ex.listeningGapFill.blanks.slice(0, 6).map(b => `
                      <td style="border: none; padding: 2pt 4pt; font-size: 9.5pt;">
                        <strong>(${b.label})</strong> ${escapeXml(b.correctAnswer || '—')}
                      </td>
                    `).join('')}
                  </tr>
                  ${ex.listeningGapFill.blanks.length > 6 ? `
                    <tr>
                      ${ex.listeningGapFill.blanks.slice(6).map(b => `
                        <td style="border: none; padding: 2pt 4pt; font-size: 9.5pt;">
                          <strong>(${b.label})</strong> ${escapeXml(b.correctAnswer || '—')}
                        </td>
                      `).join('')}
                    </tr>
                  ` : ''}
                </table>
              </div>
            ` : ''}
          </div>
        ` : ex.readingMcq ? `
          <div style="margin-top: 8pt; margin-bottom: 8pt;">
            ${ex.readingMcq.passageTitle ? `<p style="text-align: center; margin: 0 0 2pt 0;"><strong>${escapeXml(ex.readingMcq.passageTitle)}</strong></p>` : ''}
            ${ex.readingMcq.passageAuthor ? `<p style="text-align: center; margin: 0 0 6pt 0;"><em>${escapeXml(ex.readingMcq.passageAuthor)}</em></p>` : ''}
            ${ex.readingMcq.passage.split(/\n+/).filter((l) => l.trim()).map((l) => `<p style="margin: 0 0 6pt 0; text-indent: 24pt;">${escapeXml(l.trim())}</p>`).join('')}
            ${ex.readingMcq.questions.map((q, i) => `<p style="margin: 6pt 0 2pt 0;"><strong>${i + 1}.</strong> ${escapeXml(q.text)}</p>
              ${q.options.map((o, oi) => `<p style="margin: 0 0 1pt 14pt;"><strong>${String.fromCharCode(65 + oi)}.</strong> ${escapeXml(o.text)}</p>`).join('')}`).join('')}
          </div>
        ` : ex.listeningMcq ? `
          <div style="margin-top: 8pt; margin-bottom: 8pt;">
            ${ex.listeningMcq.questions.map((q, i) => `<p style="margin: 0 0 2pt 0;"><strong>${i + 1}.</strong> ${escapeXml(q.text)}</p>
              <p style="margin: 0 0 8pt 14pt;">${q.options.map((o, oi) => `<strong>${String.fromCharCode(97 + oi)}.</strong> ${escapeXml(o.text)}`).join('&#160;&#160;&#160;&#160;')}</p>`).join('')}
          </div>
        ` : ex.grammarMcq ? `
          <div style="margin-top: 8pt; margin-bottom: 8pt;">
            ${ex.grammarMcq.questions.map((q, i) => `<p style="margin: 0 0 2pt 0;"><strong>${i + 1}.</strong> ${escapeXml(q.text)}</p>
              <p style="margin: 0 0 8pt 14pt;">${q.options.map((o, oi) => `<strong>${String.fromCharCode(97 + oi)}.</strong> ${escapeXml(o.text).replace(/\[([^\]]+)\]/g, '<u>$1</u>')}`).join('&#160;&#160;&#160;&#160;')}</p>`).join('')}
          </div>
        ` : ex.listeningTable ? `
          <div style="margin-top: 8pt; margin-bottom: 8pt;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>${ex.listeningTable.table.columns.map((c) => `<th style="border: 0.75pt solid #3b6fd4; padding: 4pt;">${escapeXml(c)}</th>`).join('')}</tr>
              ${ex.listeningTable.table.rows.map((r) => `<tr>${r.cells.map((c, ci) => `<td style="border: 0.75pt solid #3b6fd4; padding: 4pt; vertical-align: top;">${ci === 0 ? '<strong>' : ''}${escapeXml(c).replace(/\n/g, '<br/>')}${ci === 0 ? '</strong>' : ''}</td>`).join('')}</tr>`).join('')}
            </table>
            <ol style="margin-top: 8pt;">${ex.listeningTable.questions.map((q) => `<li style="margin-bottom: 6pt;">${escapeXml(q.text)} ____________________</li>`).join('')}</ol>
          </div>
        ` : ex.listeningMatching ? `
          <div style="margin-top: 8pt; margin-bottom: 8pt;">
            ${ex.listeningMatching.problems.map((q, i) => `<p style="margin: 0 0 4pt 0;"><strong>${i + 1}.</strong> ${escapeXml(q.text)} ____________</p>`).join('')}
            ${ex.listeningMatching.options.map((o, i) => `<p style="margin: 0 0 4pt 14pt;"><strong>${String.fromCharCode(97 + i)}.</strong> ${escapeXml(o.text)}</p>`).join('')}
          </div>
        ` : ex.listeningTrueFalse ? `
          <div style="margin-top: 8pt; margin-bottom: 8pt;">
            <table style="width: 100%; border-collapse: collapse;">
              ${ex.listeningTrueFalse.statements.map((st, i) => `<tr>
                <td style="width: 6%; padding: 5pt 4pt;"><strong>${i + 1}.</strong></td>
                <td style="width: 70%; padding: 5pt 4pt;">${escapeXml(st.text)}</td>
                <td style="width: 24%; padding: 5pt 4pt; border-bottom: 0.75pt solid #444;">&#160;</td>
              </tr>`).join('')}
            </table>
          </div>
        ` : ex.matchingHeadings ? `
          <div style="margin-top: 8pt; margin-bottom: 8pt;">
            ${ex.matchingHeadings.passageTitle ? `<p style="text-align: center;"><strong>${escapeXml(ex.matchingHeadings.passageTitle)}</strong></p>` : ''}
            ${ex.matchingHeadings.paragraphs.map((p) => `<p style="text-align: justify; text-indent: 22pt;">${escapeXml(p.text)}</p>`).join('')}
            <table style="width: 100%; border-collapse: collapse; margin-top: 8pt;">
              ${Array.from({ length: Math.max(ex.matchingHeadings.paragraphs.length, ex.matchingHeadings.ideas.length) }).map((_, i) => {
                const idea = ex.matchingHeadings?.ideas[i];
                return `<tr>
                  <td style="width: 30%; padding: 3pt 4pt;">${ex.matchingHeadings?.paragraphs[i] ? `<strong>${i + 1}.</strong> Paragraph ${i + 1}` : ''}</td>
                  <td style="width: 70%; padding: 3pt 4pt;">${idea ? `<strong>${String.fromCharCode(97 + (i % 26))}.</strong> ${escapeXml(idea.text)}` : ''}</td>
                </tr>`;
              }).join('')}
            </table>
          </div>
        ` : ex.sentenceCompletion ? `
          <div style="margin-top: 8pt; margin-bottom: 8pt;">
            ${ex.sentenceCompletion.settings.showWordBank && ex.sentenceCompletion.words.length ? `<p style="text-align: center; border: 1pt solid #111; padding: 4pt;"><strong>${ex.sentenceCompletion.words.map((w) => escapeXml(w.text)).join(' &#160;&#160;&#160; ')}</strong></p>` : ''}
            <table style="width: 100%; border-collapse: collapse;">
              ${ex.sentenceCompletion.sentences.map((st, i) => `<tr>
                <td style="width: 6%; padding: 4pt;"><strong>${i + 1}.</strong></td>
                <td style="width: ${ex.sentenceCompletion!.settings.layout === 'error_correction' ? '54%' : st.hint ? '64%' : '94%'}; padding: 4pt;">${escapeXml(st.text.replace(/_{3,}/g, '____________'))}${ex.sentenceCompletion!.settings.layout === 'rewrite' ? `<br/>${escapeXml(st.starter || '')} ______________________________` : ''}</td>
                ${ex.sentenceCompletion!.settings.layout === 'error_correction' ? '<td style="width: 40%; padding: 4pt; border-bottom: 1pt solid #111;">&#160;</td>' : ''}
                ${st.hint ? `<td style="width: 30%; padding: 4pt;"><em><strong>(${escapeXml(st.hint)})</strong></em></td>` : ''}
              </tr>`).join('')}
            </table>
          </div>
        ` : ex.gapFilling ? `
          <div style="margin-top: 8pt; margin-bottom: 8pt;">
            ${ex.gapFilling.words.length ? `<p style="text-align: center; border: 1pt solid #111; padding: 4pt;"><strong>${ex.gapFilling.words.map((w) => escapeXml(w.text)).join(' &#160;&#160;&#160; ')}</strong></p>` : ''}
            ${passageParagraphs(ex.gapFilling.passage).map((para) => `<p style="text-align: justify; line-height: 200%;">${escapeXml(para.replace(/_{3,}/g, '____________'))}</p>`).join('')}
          </div>
        ` : ex.tfng ? `
          <div style="margin-top: 8pt; margin-bottom: 8pt;">
            <table style="width: 100%; border-collapse: collapse;">
              ${ex.tfng.statements.map((st, i) => `<tr>
                <td style="width: 6%; padding: 5pt 4pt;"><strong>${i + 1}.</strong></td>
                <td style="width: 74%; padding: 5pt 4pt;">${escapeXml(st.text)}</td>
                <td style="width: 20%; padding: 5pt 4pt;"><strong>T &#160;&#160; F &#160;&#160; NG</strong></td>
              </tr>`).join('')}
            </table>
          </div>
        ` : ex.matchingVocabulary ? `
          <div style="margin-top: 8pt; margin-bottom: 8pt;">
            <table style="width: 100%; border-collapse: collapse;">
              ${Array.from({ length: Math.max(ex.matchingVocabulary.words.length, ex.matchingVocabulary.definitions.length) }).map((_, i) => {
                const w = ex.matchingVocabulary?.words[i];
                const d = ex.matchingVocabulary?.definitions[i];
                return `<tr>
                  <td style="width: 45%; padding: 5pt 4pt;">${w ? `<strong>${i + 1}.</strong> ${escapeXml(w.text)}` : ''}</td>
                  <td style="width: 8%; padding: 5pt 4pt;">${w ? '[ &#160;&#160;]' : ''}</td>
                  <td style="width: 47%; padding: 5pt 4pt; border-left: 0.5pt solid #999;">${d ? `<strong>${String.fromCharCode(97 + (i % 26))}.</strong> ${escapeXml(d.text)}` : ''}</td>
                </tr>`;
              }).join('')}
            </table>
          </div>
        ` : ex.matchingPictures ? `
          <div style="margin-top: 8pt; margin-bottom: 8pt;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 6pt;">
              ${ex.matchingPictures.paragraphs.map(p => {
                const map = ex.matchingPictures?.answerMapping.find(m => m.paragraphId === p.id);
                const targetImg = ex.matchingPictures?.images.find(img => img.id === map?.imageId);
                const answerLetter = targetImg ? targetImg.label : '';
                return `
                  <tr>
                    <td style="border: 1pt solid #e2e8f0; padding: 6pt; width: 80%;">
                      <strong>Paragraph ${p.order}:</strong> ${escapeXml(p.text)}
                    </td>
                    <td style="border: 1pt solid #e2e8f0; padding: 6pt; width: 20%; text-align: center; font-weight: bold; font-size: 11pt; color: #1d4ed8;">
                      [ ${isTeacher ? escapeXml(answerLetter) : '&nbsp;&nbsp;&nbsp;'} ]
                    </td>
                  </tr>
                `;
              }).join('')}
            </table>

            ${isTeacher ? `
              <div style="background-color: #eff6ff; border: 1pt solid #bfdbfe; padding: 6pt 10pt; margin-top: 8pt;">
                <strong style="color: #1e40af; font-size: 10pt;">TEACHER ANSWER KEY:</strong>
                <table style="width: 100%; border: none; margin-top: 4pt;">
                  <tr>
                    ${ex.matchingPictures.paragraphs.map(p => {
                      const map = ex.matchingPictures?.answerMapping.find(m => m.paragraphId === p.id);
                      const targetImg = ex.matchingPictures?.images.find(img => img.id === map?.imageId);
                      return `
                        <td style="border: none; padding: 2pt 4pt; font-size: 9.5pt;">
                          <strong>P${p.order}</strong> &rarr; Image <strong>${targetImg?.label || '—'}</strong> (${escapeXml(targetImg?.caption || '')})
                        </td>
                      `;
                    }).join('')}
                  </tr>
                </table>
              </div>
            ` : ''}
          </div>
        ` : `
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
        `}
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
