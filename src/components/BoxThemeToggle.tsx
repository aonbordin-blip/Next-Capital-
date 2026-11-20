import React from 'react';
import { Layers, Moon, Palette, Sun } from 'lucide-react';
import { BOX_THEME_OPTIONS, BoxThemeMode, useBoxTheme } from '../utils/boxTheme';
import { triggerHaptic } from '../utils/haptics';

interface BoxThemeToggleProps {
  compact?: boolean;
  showLabel?: boolean;
  className?: string;
}

const THEME_ICONS: Record<BoxThemeMode, React.ReactNode> = {
  light: <Sun className="w-3.5 h-3.5 shrink-0" />,
  dimensional: <Layers className="w-3.5 h-3.5 shrink-0" />,
  dark: <Moon className="w-3.5 h-3.5 shrink-0" />,
};

export const BoxThemeToggle: React.FC<BoxThemeToggleProps> = ({
  compact = false,
  showLabel = false,
  className = '',
}) => {
  const [theme, setTheme] = useBoxTheme();

  return (
    <div
      className={`inline-flex items-center gap-2 ${className}`.trim()}
    >
      {showLabel && (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap shrink-0">
          <Palette className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
          <span>โหมดสีกล่องข้อมูล</span>
        </span>
      )}

      <div
        role="group"
        aria-label="สลับโหมดสีกล่องข้อมูล"
        className={`inline-flex items-center gap-0.5 rounded-xl border transition-colors ${
          compact
            ? 'p-0.5 bg-slate-100/80 dark:bg-slate-800/90 border-white/90 dark:border-slate-700/80 shadow-2xs'
            : 'p-1 bg-white/70 dark:bg-slate-900/75 backdrop-blur-md border-white/90 dark:border-slate-700/80 shadow-2xs'
        }`}
      >
        {BOX_THEME_OPTIONS.map((opt) => {
          const isActive = theme === opt.id;
          const activeClasses =
            opt.id === 'dark'
              ? 'bg-gradient-to-r from-slate-800 via-indigo-950 to-slate-900 text-sky-200 border border-sky-400/40 shadow-xs'
              : opt.id === 'dimensional'
              ? 'bg-gradient-to-r from-sky-500 to-cyan-600 text-white border border-sky-400/50 shadow-xs'
              : 'bg-white text-sky-900 border border-sky-200/80 shadow-xs';

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                if (theme === opt.id) return;
                triggerHaptic('selection');
                setTheme(opt.id);
              }}
              aria-pressed={isActive}
              title={opt.description}
              className={`flex items-center justify-center gap-1 rounded-lg font-bold transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                compact ? 'px-2 py-1 text-[10.5px]' : 'px-2.5 py-1 text-[11px]'
              } ${
                isActive
                  ? activeClasses
                  : 'border border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/80'
              }`}
            >
              <span
                className={
                  isActive
                    ? opt.id === 'light'
                      ? 'text-amber-500'
                      : opt.id === 'dark'
                      ? 'text-sky-300'
                      : 'text-white'
                    : opt.id === 'light'
                    ? 'text-amber-500 dark:text-amber-400'
                    : opt.id === 'dark'
                    ? 'text-indigo-500 dark:text-indigo-300'
                    : 'text-sky-600 dark:text-sky-400'
                }
              >
                {THEME_ICONS[opt.id]}
              </span>
              <span>{compact ? opt.shortLabel : opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
