import React from 'react';
import { Images, Image as ImageIcon, ArrowRight } from 'lucide-react';
import type { LessonFolder } from '../../types';
import { SupabaseLibrary } from './SupabaseLibrary';

interface GalleryScreenProps {
  folders: LessonFolder[];
  onOpenFolder: (folderId: string) => void;
}

export const GalleryScreen: React.FC<GalleryScreenProps> = ({
  folders,
  onOpenFolder,
}) => {
  // Aggregate all images currently assigned in folders
  const assignedImages = folders.flatMap((f) =>
    f.exercises.flatMap((ex) =>
      ex.imageSlots
        .filter((slot) => !!slot.assetUrl)
        .map((slot) => ({
          slot,
          exerciseTitle: ex.title,
          folderId: f.id,
          folderName: f.name,
        }))
    )
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-50 p-6 md:p-8 select-text">
      <div className="max-w-5xl w-full mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Images size={22} className="text-blue-600" />
              My Gallery
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Teaching illustrations, diagram assets, and photos assigned across your lesson folders.
            </p>
          </div>
        </div>

        {/* Ảnh đã lưu trên Supabase (qua extension) */}
        <SupabaseLibrary />

        {/* Ảnh đang gán trong các lesson folder */}
        <h2 className="text-sm font-bold text-slate-700 pt-2">Ảnh đang dùng trong các Lesson Folder</h2>
        {/* Images Grid */}
        {assignedImages.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <ImageIcon size={20} />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Image Assets Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
              When you upload or generate illustrations inside any exercise or AI Image Studio, they will appear in this centralized library.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {assignedImages.map((item, idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:border-blue-400 transition-all flex flex-col justify-between group"
              >
                <div className="h-36 bg-slate-50 overflow-hidden flex items-center justify-center p-2 relative">
                  <img
                    src={item.slot.assetUrl}
                    alt={item.slot.caption || `Picture ${item.slot.label}`}
                    className="w-full h-full object-contain"
                  />
                  <span className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-white">
                    {item.slot.widthMm} × {item.slot.heightMm} mm
                  </span>
                </div>

                <div className="p-3 border-t border-slate-100 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 line-clamp-1">
                      {item.slot.caption || `Picture ${item.slot.label}`}
                    </h4>
                    <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                      {item.exerciseTitle}
                    </p>
                  </div>

                  <button
                    onClick={() => onOpenFolder(item.folderId)}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                  >
                    <span>{item.folderName}</span>
                    <ArrowRight size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
