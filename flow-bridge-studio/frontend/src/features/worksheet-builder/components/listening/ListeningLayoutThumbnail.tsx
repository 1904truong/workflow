import React from 'react';
import type { ListeningLayoutId } from '../../services/listening/listeningGapFillCore';

// ── Mini SVG / CSS Thumbnail Component for 6 Listening Layouts ──
export const ListeningLayoutThumbnail: React.FC<{ layout: ListeningLayoutId; className?: string }> = ({
  layout,
  className = 'w-10 h-8',
}) => {
  switch (layout) {
    case 'original':
      return (
        <div className={`${className} bg-slate-50 border border-slate-300 rounded p-1 flex justify-between shrink-0 shadow-2xs`}>
          <div className="space-y-0.5 flex-1 pr-1">
            <div className="h-0.5 bg-slate-400 rounded w-full" />
            <div className="h-0.5 bg-slate-300 rounded w-4/5" />
            <div className="h-0.5 bg-slate-400 rounded w-full" />
            <div className="h-0.5 bg-slate-300 rounded w-2/3" />
          </div>
          <div className="w-2.5 h-full bg-blue-500 rounded-xs shrink-0" />
        </div>
      );
    case 'numbered':
      return (
        <div className={`${className} bg-slate-50 border border-slate-300 rounded p-1 flex justify-between shrink-0 shadow-2xs`}>
          <div className="space-y-0.5 flex-1 pr-1">
            <div className="flex items-center gap-0.5">
              <span className="text-[5px] font-bold text-blue-600">1</span>
              <div className="h-0.5 bg-slate-400 rounded w-full" />
            </div>
            <div className="flex items-center gap-0.5">
              <span className="text-[5px] font-bold text-blue-600">2</span>
              <div className="h-0.5 bg-slate-400 rounded w-3/4" />
            </div>
          </div>
          <div className="w-2.5 h-full bg-blue-500 rounded-xs shrink-0" />
        </div>
      );
    case 'two_columns':
      return (
        <div className={`${className} bg-slate-50 border border-slate-300 rounded p-1 grid grid-cols-2 gap-1 shrink-0 shadow-2xs`}>
          <div className="space-y-0.5 border-r border-slate-200 pr-0.5">
            <div className="h-0.5 bg-slate-400 rounded w-full" />
            <div className="h-0.5 bg-slate-300 rounded w-2/3" />
          </div>
          <div className="space-y-0.5">
            <div className="h-0.5 bg-slate-400 rounded w-full" />
            <div className="h-0.5 bg-slate-300 rounded w-4/5" />
          </div>
        </div>
      );
    case 'answer_grid':
      return (
        <div className={`${className} bg-slate-50 border border-slate-300 rounded p-1 flex flex-col justify-between shrink-0 shadow-2xs`}>
          <div className="space-y-0.5">
            <div className="h-0.5 bg-slate-400 rounded w-full" />
            <div className="h-0.5 bg-slate-300 rounded w-4/5" />
          </div>
          <div className="border border-slate-300 rounded grid grid-cols-4 gap-0.5 p-0.5 bg-white">
            <div className="h-0.5 bg-blue-500 rounded" />
            <div className="h-0.5 bg-blue-500 rounded" />
            <div className="h-0.5 bg-blue-500 rounded" />
            <div className="h-0.5 bg-blue-500 rounded" />
          </div>
        </div>
      );
    case 'spaced_blocks':
      return (
        <div className={`${className} bg-slate-50 border border-slate-300 rounded p-0.5 flex flex-col justify-between shrink-0 shadow-2xs`}>
          <div className="border border-slate-200 rounded p-0.5 bg-white">
            <div className="h-0.5 bg-slate-400 rounded w-full" />
          </div>
          <div className="border border-slate-200 rounded p-0.5 bg-white">
            <div className="h-0.5 bg-slate-400 rounded w-full" />
          </div>
        </div>
      );
    case 'illustrated':
      return (
        <div className={`${className} bg-slate-50 border border-slate-300 rounded p-1 flex flex-col gap-0.5 shrink-0 shadow-2xs`}>
          <div className="flex items-center gap-1">
            <div className="w-2 h-1.5 bg-blue-500 rounded-xs" />
            <div className="h-0.5 bg-slate-400 rounded flex-1" />
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-1.5 bg-blue-500 rounded-xs" />
            <div className="h-0.5 bg-slate-400 rounded flex-1" />
          </div>
        </div>
      );
    case 'dialogue':
      return (
        <div className={`${className} bg-slate-50 border border-slate-300 rounded p-1 flex flex-col justify-around shrink-0 shadow-2xs`}>
          {[['bg-blue-700', 'w-4/5'], ['bg-rose-600', 'w-full'], ['bg-blue-700', 'w-2/3']].map(([c, w], i) => (
            <div key={i} className="flex items-center gap-0.5">
              <span className={`h-0.5 w-2 rounded ${c}`} />
              <span className={`h-0.5 rounded bg-slate-400 ${w}`} />
            </div>
          ))}
        </div>
      );
    case 'passage_qr':
      return (
        <div className={`${className} bg-slate-50 border border-slate-300 rounded p-1 flex flex-col gap-0.5 shrink-0 shadow-2xs`}>
          <div className="flex gap-0.5 items-start">
            <div className="flex-1 space-y-0.5"><div className="h-0.5 bg-slate-400 rounded w-full" /><div className="h-0.5 bg-slate-300 rounded w-5/6" /></div>
            <div className="w-2.5 h-2.5 bg-blue-500 rounded-xs shrink-0" />
          </div>
          <div className="h-0.5 bg-slate-400 rounded w-full" />
          <div className="h-0.5 bg-slate-300 rounded w-4/5" />
          <div className="h-0.5 bg-slate-400 rounded w-full" />
        </div>
      );
    case 'passage_image':
      return (
        <div className={`${className} bg-slate-50 border border-slate-300 rounded p-1 flex flex-col gap-0.5 shrink-0 shadow-2xs`}>
          <div className="flex gap-0.5 items-start">
            <div className="flex-1 space-y-0.5"><div className="h-0.5 bg-slate-400 rounded w-full" /><div className="h-0.5 bg-slate-300 rounded w-5/6" /><div className="h-0.5 bg-slate-400 rounded w-full" /></div>
            <div className="w-4 h-3 bg-sky-400 rounded-xs shrink-0" />
          </div>
          <div className="h-0.5 bg-slate-400 rounded w-full" />
          <div className="h-px bg-slate-400 w-3/4 mt-0.5 border-b border-dashed" />
        </div>
      );
    case 'form_completion':
      return (
        <div className={`${className} bg-slate-50 border border-slate-300 rounded p-1 flex gap-1 shrink-0 shadow-2xs`}>
          <div className="flex-1 space-y-0.5">{[0, 1, 2].map((i) => <div key={i}><span className="block h-0.5 w-1/2 bg-slate-700 rounded" /><span className="block h-px w-full mt-0.5 ml-1 bg-slate-400 border-b border-dashed" /></div>)}</div>
          <div className="w-4 h-4 bg-sky-400 rounded-xs shrink-0" />
        </div>
      );
    case 'question_list':
      return (
        <div className={`${className} bg-slate-50 border border-slate-300 rounded p-1 space-y-0.5 shrink-0 shadow-2xs`}>
          {[0, 1, 2].map((i) => <div key={i}><div className="flex items-center gap-0.5"><span className="w-2 h-0.5 bg-slate-700 rounded" /><span className="h-0.5 bg-slate-400 rounded flex-1" /></div><div className="h-px bg-slate-400 w-full mt-0.5 border-b border-dashed" /></div>)}
        </div>
      );
    case 'headed_columns':
      return (
        <div className={`${className} bg-slate-50 border border-slate-300 rounded p-1 flex gap-1 shrink-0 shadow-2xs`}>
          {[0, 1].map((c) => (
            <div key={c} className="flex-1 space-y-0.5">
              <div className="h-0.5 bg-slate-700 rounded w-3/4" />
              {[0, 1, 2].map((i) => <div key={i} className="flex items-center gap-0.5"><span className="h-0.5 bg-slate-300 rounded flex-1" /><span className="h-px w-2 bg-slate-600" /></div>)}
            </div>
          ))}
        </div>
      );
    case 'sentence_list':
      return (
        <div className={`${className} bg-slate-50 border border-slate-300 rounded p-1 space-y-0.5 shrink-0 shadow-2xs`}>
          <div className="h-0.5 bg-slate-500 rounded w-3/4" />
          <div className="h-px bg-slate-400 w-full" />
          {[0, 1, 2, 3].map((i) => <div key={i} className="flex items-center gap-0.5"><span className="h-0.5 bg-slate-300 rounded flex-1" /><span className="h-px w-3 bg-slate-600" /></div>)}
        </div>
      );
    case 'outline':
      return (
        <div className={`${className} bg-slate-50 border border-slate-300 rounded p-1 flex gap-0.5 shrink-0 shadow-2xs`}>
          <div className="flex-1 space-y-0.5">
            <div className="flex items-center gap-0.5"><span className="w-0.5 h-0.5 rounded-full bg-slate-700" /><span className="h-0.5 bg-slate-400 rounded w-4/5" /></div>
            <div className="flex items-center gap-0.5 pl-1.5"><span className="text-[3px] leading-none text-slate-700">+</span><span className="h-0.5 bg-slate-300 rounded w-3/5" /></div>
            <div className="flex items-center gap-0.5"><span className="w-0.5 h-0.5 rounded-full bg-slate-700" /><span className="h-0.5 bg-slate-400 rounded w-full" /></div>
          </div>
          <div className="w-3 h-4 bg-sky-400 rounded-xs shrink-0" />
        </div>
      );
    default:
      return null;
  }
};
