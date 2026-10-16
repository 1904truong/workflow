import React from 'react';
import type { MatchingPicturesLayoutId } from '../../services/matching-pictures/matchingPicturesCore';

// Mini schematic diagrams for the 6 layout choices
export const MatchingLayoutThumbnail: React.FC<{ layout: MatchingPicturesLayoutId; className?: string }> = ({
  layout,
  className = '',
}) => {
  switch (layout) {
    case 'original_grid':
      return (
        <div className={`p-1 bg-slate-100 rounded border border-slate-200 flex gap-1 ${className}`}>
          <div className="w-1/3 flex flex-col justify-between py-0.5">
            <div className="h-1 bg-slate-400 rounded-xs" />
            <div className="h-1 bg-slate-400 rounded-xs" />
            <div className="h-1 bg-slate-400 rounded-xs" />
          </div>
          <div className="w-2/3 grid grid-cols-2 gap-0.5">
            <div className="bg-blue-400 rounded-xs h-3" />
            <div className="bg-blue-400 rounded-xs h-3" />
            <div className="bg-blue-400 rounded-xs h-3" />
            <div className="bg-blue-400 rounded-xs h-3" />
          </div>
        </div>
      );
    case 'picture_grid':
      return (
        <div className={`p-1 bg-slate-100 rounded border border-slate-200 flex flex-col justify-between ${className}`}>
          <div className="grid grid-cols-3 gap-0.5">
            <div className="bg-blue-400 rounded-xs h-2.5" />
            <div className="bg-blue-400 rounded-xs h-2.5" />
            <div className="bg-blue-400 rounded-xs h-2.5" />
          </div>
          <div className="h-1 bg-slate-400 rounded-xs mt-1" />
          <div className="flex gap-0.5 mt-0.5">
            <div className="h-1.5 flex-1 bg-slate-300 rounded-xs" />
            <div className="h-1.5 flex-1 bg-slate-300 rounded-xs" />
            <div className="h-1.5 flex-1 bg-slate-300 rounded-xs" />
          </div>
        </div>
      );
    case 'side_by_side':
      return (
        <div className={`p-1 bg-slate-100 rounded border border-slate-200 flex gap-1 ${className}`}>
          <div className="w-1/2 space-y-0.5">
            <div className="h-1 bg-slate-400 rounded-xs" />
            <div className="h-1 bg-slate-400 rounded-xs" />
            <div className="h-1 bg-slate-400 rounded-xs" />
          </div>
          <div className="w-1/2 grid grid-cols-2 gap-0.5">
            <div className="bg-blue-400 rounded-xs h-3" />
            <div className="bg-blue-400 rounded-xs h-3" />
          </div>
        </div>
      );
    case 'draw_lines':
      return (
        <div className={`p-1 bg-slate-100 rounded border border-slate-200 flex justify-between items-center ${className}`}>
          <div className="space-y-1">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
          </div>
          <div className="w-4 border-b border-dashed border-blue-400 rotate-12" />
          <div className="space-y-1">
            <div className="w-3 h-2 bg-blue-400 rounded-xs" />
            <div className="w-3 h-2 bg-blue-400 rounded-xs" />
            <div className="w-3 h-2 bg-blue-400 rounded-xs" />
          </div>
        </div>
      );
    case 'picture_cards':
      return (
        <div className={`p-1 bg-slate-100 rounded border border-slate-200 flex flex-col justify-between ${className}`}>
          <div className="grid grid-cols-3 gap-0.5">
            <div className="border border-slate-300 bg-white p-0.5 rounded-xs">
              <div className="bg-blue-400 h-2 rounded-xs" />
              <div className="h-0.5 bg-slate-300 mt-0.5" />
            </div>
            <div className="border border-slate-300 bg-white p-0.5 rounded-xs">
              <div className="bg-blue-400 h-2 rounded-xs" />
              <div className="h-0.5 bg-slate-300 mt-0.5" />
            </div>
            <div className="border border-slate-300 bg-white p-0.5 rounded-xs">
              <div className="bg-blue-400 h-2 rounded-xs" />
              <div className="h-0.5 bg-slate-300 mt-0.5" />
            </div>
          </div>
          <div className="h-1 bg-slate-400 rounded-xs mt-1" />
        </div>
      );
    case 'compact':
      return (
        <div className={`p-1 bg-slate-100 rounded border border-slate-200 flex flex-col justify-between ${className}`}>
          <div className="flex gap-0.5">
            <div className="bg-blue-400 rounded-xs h-2 flex-1" />
            <div className="bg-blue-400 rounded-xs h-2 flex-1" />
            <div className="bg-blue-400 rounded-xs h-2 flex-1" />
            <div className="bg-blue-400 rounded-xs h-2 flex-1" />
          </div>
          <div className="mt-1 border border-slate-300 bg-white p-0.5 rounded-xs space-y-0.5">
            <div className="h-0.5 bg-slate-400" />
            <div className="h-0.5 bg-slate-400" />
          </div>
        </div>
      );
    default:
      return null;
  }
};
