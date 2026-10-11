import React from 'react';
import { 
  Folder, PlusCircle, Wand2, Images, History, Settings2, HelpCircle, 
  Sparkles
} from 'lucide-react';

export type MainNavId = 
  | 'lessons' 
  | 'create_new' 
  | 'images' 
  | 'gallery' 
  | 'history' 
  | 'settings' 
  | 'guide';

interface AppSidebarProps {
  activeNav: MainNavId;
  onNavigate: (navId: MainNavId) => void;
  foldersCount?: number;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeNav,
  onNavigate,
  foldersCount = 0,
}) => {
  const navItems = [
    { 
      id: 'lessons' as const, 
      label: 'Lesson Folders', 
      icon: Folder, 
      badge: foldersCount > 0 ? String(foldersCount) : undefined 
    },
    { 
      id: 'create_new' as const, 
      label: 'Create New', 
      icon: PlusCircle,
      highlight: true
    },
    { 
      id: 'images' as const, 
      label: 'AI Image Studio', 
      icon: Wand2 
    },
    { 
      id: 'gallery' as const, 
      label: 'My Gallery', 
      icon: Images 
    },
    { 
      id: 'history' as const, 
      label: 'Export History', 
      icon: History 
    },
    { 
      id: 'settings' as const, 
      label: 'Settings', 
      icon: Settings2 
    },
    { 
      id: 'guide' as const, 
      label: 'Help & Guide', 
      icon: HelpCircle 
    },
  ];

  return (
    <aside className="w-[248px] bg-white border-r border-slate-200 flex flex-col shrink-0 select-none z-30 shadow-2xs">
      {/* Brand Header */}
      <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-slate-900 tracking-tight leading-none">Flow Bridge</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-sm bg-blue-100 text-blue-700">Studio</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">
              Worksheet Creator
            </p>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Navigation
          </span>
        </div>

        {navItems.map((item) => {
          const isActive = activeNav === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-bold shadow-2xs ring-1 ring-blue-500/20'
                  : item.highlight
                  ? 'text-blue-600 hover:bg-blue-50/60 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon
                  size={16}
                  className={`shrink-0 transition-colors ${
                    isActive
                      ? 'text-blue-600'
                      : item.highlight
                      ? 'text-blue-600'
                      : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-blue-200/80 text-blue-800' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Teacher Profile Footer */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50">
        <div className="p-2 rounded-xl bg-white border border-slate-200/70 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
              SJ
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">Sarah Jenkins</p>
              <p className="text-[10px] text-slate-400 truncate">English Department</p>
            </div>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500" title="Online" />
        </div>
      </div>
    </aside>
  );
};
