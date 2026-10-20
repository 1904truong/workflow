import React from 'react';
import { HelpCircle, BookOpen, Sparkles, Printer } from 'lucide-react';
import { EXERCISE_REGISTRY } from '../../templates/registry';

export const HelpGuideScreen: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-50 p-6 md:p-8 select-text">
      <div className="max-w-4xl w-full mx-auto space-y-6">
        
        {/* Top Header */}
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <HelpCircle size={22} className="text-blue-600" />
            Teacher Guide & Specifications
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete guide to the 15 English exercise formats, Smart Paste parsing, and ISO A4 print standards.
          </p>
        </div>

        {/* 1. Core Workflow Overview */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-3">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5 pb-2 border-b border-slate-100">
            <Sparkles size={14} className="text-blue-600" />
            Ideal Teacher Workflow
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-200/60">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center mb-2">1</span>
              <h3 className="font-bold text-slate-900 mb-1">Create Folder</h3>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Set up a teaching unit or topic with grade level, duration, and target skills.
              </p>
            </div>
            <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-200/60">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center mb-2">2</span>
              <h3 className="font-bold text-slate-900 mb-1">Add Content</h3>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Paste an entire test via Smart Paste or create questions manually using 15 formats.
              </p>
            </div>
            <div className="p-3.5 bg-purple-50/60 rounded-2xl border border-purple-200/60">
              <span className="w-5 h-5 rounded-full bg-purple-600 text-white font-bold text-[10px] flex items-center justify-center mb-2">3</span>
              <h3 className="font-bold text-slate-900 mb-1">Add Images</h3>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Assign illustrations to image placeholders via AI Image Studio or manual file upload.
              </p>
            </div>
            <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-200/60">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center mb-2">4</span>
              <h3 className="font-bold text-slate-900 mb-1">Preview & Export</h3>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Download the printable worksheet in PDF and editable DOCX formats.
              </p>
            </div>
          </div>
        </div>

        {/* 2. The 15 Canonical Exercise Types */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5 pb-2 border-b border-slate-100">
            <BookOpen size={14} className="text-blue-600" />
            The 15 Supported Exercise Formats
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {Object.values(EXERCISE_REGISTRY).map((meta) => (
              <div
                key={meta.type}
                className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[9px] font-bold px-2 py-0.2 rounded-full uppercase ${
                      meta.category === 'Listening'
                        ? 'bg-purple-100 text-purple-700'
                        : meta.category === 'Reading'
                        ? 'bg-emerald-100 text-emerald-700'
                        : meta.category === 'Writing'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {meta.category}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Default: {meta.defaultTemplate.replace('_', ' ')}
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-xs">{meta.label}</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {meta.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 3. A4 Print Standards - Powered by shadcn/typeset */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-xs">
          <div className="typeset typeset-docs max-w-[37em]">
            <div className="flex items-center gap-2 not-typeset mb-2 text-slate-800 font-bold text-sm tracking-wide uppercase">
              <Printer size={16} className="text-blue-600" />
              <span>ISO A4 Print Layout Specifications</span>
            </div>
            <h2>Standard Physical Dimensions</h2>
            <p>
              Worksheets in Flow Bridge Studio strictly follow physical ISO A4 standards (<strong>210 mm × 297 mm</strong>) with <strong>15 mm page margins</strong>, yielding an exact printable content width of <strong>180 mm</strong>.
            </p>
            <p>
              Fonts are standardized to <strong>Arial 16pt bold</strong> for document headers, <strong>Arial 12pt bold</strong> for exercise headings, and <strong>Arial 11pt</strong> with a 1.35 line height for questions and reading passages. Long passages split gracefully across subsequent pages without cutting questions or images.
            </p>
            <ul>
              <li><strong>Physical Paper:</strong> ISO 216 A4 (210 × 297 mm) with exact millimeter sizing.</li>
              <li><strong>Print Isolation:</strong> Trang in A4 sử dụng font Arial và kích thước pt độc lập, hoàn toàn không bị ảnh hưởng bởi typography web.</li>
              <li><strong>Web Interface:</strong> Trang tài liệu và hướng dẫn web sử dụng font Geist với tỷ lệ dòng 1.6 qua preset <code>typeset-docs</code>.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
