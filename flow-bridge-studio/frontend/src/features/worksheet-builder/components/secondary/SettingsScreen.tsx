import React, { useState } from 'react';
import { Settings2, School, Database, Check, RotateCcw, ShieldCheck } from 'lucide-react';

interface SettingsScreenProps {
  onResetSamples: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onResetSamples,
}) => {
  const [schoolName, setSchoolName] = useState(
    localStorage.getItem('fb_default_school') || 'Pinta English'
  );
  const [teacherName, setTeacherName] = useState(
    localStorage.getItem('fb_default_teacher') || 'Sarah Jenkins'
  );
  const [supabaseUrl, setSupabaseUrl] = useState(
    localStorage.getItem('fb_supabase_url') || ''
  );
  const [supabaseKey, setSupabaseKey] = useState(
    localStorage.getItem('fb_supabase_key') || ''
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('fb_default_school', schoolName.trim());
    localStorage.setItem('fb_default_teacher', teacherName.trim());
    // Chỉ nhận địa chỉ dự án hợp lệ (chặn trường hợp trình duyệt tự điền email vào ô này)
    if (/^https?:\/\/[^\s/@]+\.[^\s/@]+/i.test(supabaseUrl.trim())) localStorage.setItem('fb_supabase_url', supabaseUrl.trim().replace(/\/+$/, ''));
    else if (supabaseUrl.trim()) { window.alert('Supabase Project URL không hợp lệ. Dạng đúng: https://xxxx.supabase.co'); return; }
    if (supabaseKey.trim()) localStorage.setItem('fb_supabase_key', supabaseKey.trim());

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-50 p-6 md:p-8 select-text">
      <div className="max-w-3xl w-full mx-auto space-y-6">
        
        {/* Top Header */}
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Settings2 size={22} className="text-blue-600" />
            Application Settings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure default school information, print presets, and database storage preferences.
          </p>
        </div>

        {savedSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2 font-semibold">
            <Check size={16} className="text-emerald-600" />
            Settings saved successfully!
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Teacher & School Defaults Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <School size={14} className="text-blue-600" />
              Teacher & School Header Defaults
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Default School Name
                </label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Default Teacher Name
                </label>
                <input
                  type="text"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Print Standards Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-3">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <ShieldCheck size={14} className="text-blue-600" />
              ISO A4 Print Specifications (Strict Standards)
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-bold">Paper Size</span>
                <span className="font-bold text-slate-800">ISO A4 Portrait</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-bold">Dimensions</span>
                <span className="font-bold text-slate-800">210 × 297 mm</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-bold">Margins</span>
                <span className="font-bold text-slate-800">15 mm (All sides)</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-bold">Content Width</span>
                <span className="font-bold text-slate-800">180 mm exact</span>
              </div>
            </div>
          </div>

          {/* Supabase Storage Integration Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <Database size={14} className="text-blue-600" />
                Supabase Database Connection (Optional Sync)
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Local Storage Active
              </span>
            </div>

            <p className="text-xs text-slate-500">
              Flow Bridge Studio automatically saves all your folders, exercises, and image slots locally. Configure your Supabase project URL and anon public key if you wish to sync to your remote cloud database.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Supabase Project URL
                </label>
                <input
                  type="text"
                  name="supabase-project-url"
                  autoComplete="off"
                  inputMode="url"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://xyz.supabase.co"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Supabase Anon Public Key
                </label>
                <input
                  type="password"
                  name="supabase-anon-key"
                  autoComplete="new-password"
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onResetSamples}
              className="text-xs font-semibold text-slate-500 hover:text-amber-700 flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw size={13} /> Reset to Sample Lesson Folders
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 transition-all active:scale-95"
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
