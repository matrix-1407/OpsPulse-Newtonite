import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sliders, Check, Sparkles, Sun, Moon } from 'lucide-react';

export type AnimationVariant = 'circle' | 'rectangle' | 'polygon' | 'circle-blur';
export type AnimationStart =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right';

type ViewTransitionDoc = Document & {
  startViewTransition?: (callback: () => void) => { ready: Promise<void>; finished: Promise<void> };
};

export function getPositionCoords(start: AnimationStart): string {
  switch (start) {
    case 'top-left':
      return '0% 0%';
    case 'top-right':
      return '100% 0%';
    case 'bottom-left':
      return '0% 100%';
    case 'bottom-right':
      return '100% 100%';
    case 'center':
      return '50% 50%';
    case 'top':
      return '50% 0%';
    case 'bottom':
      return '50% 100%';
    case 'left':
      return '0% 50%';
    case 'right':
      return '100% 50%';
    default:
      return '100% 0%';
  }
}

export function getTransformOrigin(start: AnimationStart): string {
  switch (start) {
    case 'top-left':
      return 'top left';
    case 'top-right':
      return 'top right';
    case 'bottom-left':
      return 'bottom left';
    case 'bottom-right':
      return 'bottom right';
    case 'center':
      return 'center center';
    case 'top':
      return 'top center';
    case 'bottom':
      return 'bottom center';
    case 'left':
      return 'center left';
    case 'right':
      return 'center right';
    default:
      return 'top right';
  }
}

export function createAnimation(
  variant: AnimationVariant,
  start: AnimationStart,
  blur: boolean
): string {
  const coords = getPositionCoords(start);

  let keyframes = '';

  if (variant === 'circle') {
    keyframes = `
      @keyframes skiper-theme-transition {
        from {
          clip-path: circle(0px at ${coords});
          ${blur ? 'filter: blur(16px);' : ''}
        }
        to {
          clip-path: circle(150vmax at ${coords});
          ${blur ? 'filter: blur(0px);' : ''}
        }
      }
    `;
  } else if (variant === 'circle-blur') {
    keyframes = `
      @keyframes skiper-theme-transition {
        0% {
          clip-path: circle(0px at ${coords});
          filter: blur(28px) brightness(1.2);
        }
        60% {
          filter: blur(10px) brightness(1.05);
        }
        100% {
          clip-path: circle(150vmax at ${coords});
          filter: blur(0px) brightness(1);
        }
      }
    `;
  } else if (variant === 'rectangle') {
    let fromInset = 'inset(0 0 100% 0)'; // top-down
    if (start === 'bottom' || start === 'bottom-left' || start === 'bottom-right') {
      fromInset = 'inset(100% 0 0 0)'; // bottom-up
    } else if (start === 'left') {
      fromInset = 'inset(0 100% 0 0)';
    } else if (start === 'right' || start === 'top-right') {
      fromInset = 'inset(0 0 0 100%)';
    }

    keyframes = `
      @keyframes skiper-theme-transition {
        from {
          clip-path: ${fromInset};
          ${blur ? 'filter: blur(16px);' : ''}
        }
        to {
          clip-path: inset(0 0 0 0);
          ${blur ? 'filter: blur(0px);' : ''}
        }
      }
    `;
  } else if (variant === 'polygon') {
    keyframes = `
      @keyframes skiper-theme-transition {
        0% {
          clip-path: polygon(100% 0%, 100% 0%, 100% 0%, 100% 0%);
          ${blur ? 'filter: blur(18px);' : ''}
        }
        50% {
          clip-path: polygon(25% 0%, 100% 0%, 100% 75%, 40% 100%);
        }
        100% {
          clip-path: polygon(-30% 0%, 130% 0%, 130% 130%, -30% 130%);
          ${blur ? 'filter: blur(0px);' : ''}
        }
      }
    `;
  }

  return `
    ${keyframes}
    ::view-transition-old(root) {
      animation: none;
      z-index: 1;
    }
    ::view-transition-new(root) {
      animation: skiper-theme-transition 0.65s var(--expo-out);
      z-index: 99999;
    }
  `;
}

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  variant: AnimationVariant;
  setVariant: (v: AnimationVariant) => void;
  start: AnimationStart;
  setStart: (s: AnimationStart) => void;
  blur: boolean;
  setBlur: (b: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('opspulse-theme');
      if (saved) return saved === 'dark';
      // Default to light mode as requested
      return false;
    }
    return false;
  });

  const [variant, setVariant] = useState<AnimationVariant>('circle');
  const [start, setStart] = useState<AnimationStart>('top-right');
  const [blur, setBlur] = useState<boolean>(false);

  // Sync initial class on mount
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const nextIsDark = !isDark;

    // 1. Inject or update transition styles
    let styleEl = document.getElementById('theme-transition-styles') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'theme-transition-styles';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = createAnimation(variant, start, blur);

    const doc = document as ViewTransitionDoc;

    if (!doc.startViewTransition) {
      // Fallback if browser doesn't support View Transition API
      if (nextIsDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('opspulse-theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('opspulse-theme', 'light');
      }
      setIsDark(nextIsDark);
      return;
    }

    // 2. Synchronous DOM mutation inside startViewTransition
    const transition = doc.startViewTransition(() => {
      if (nextIsDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('opspulse-theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('opspulse-theme', 'light');
      }
      setIsDark(nextIsDark);
    });

    transition.finished.catch(() => {
      // ignore cancelled transitions
    });
  }, [isDark, variant, start, blur]);

  return (
    <ThemeContext.Provider
      value={{
        isDark,
        toggleTheme,
        variant,
        setVariant,
        start,
        setStart,
        blur,
        setBlur,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useThemeToggle(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useThemeToggle must be used within a ThemeProvider');
  }
  return ctx;
}

export const ThemeToggleButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isDark, toggleTheme, variant, setVariant, start, setStart, blur, setBlur } = useThemeToggle();
  const [showOptions, setShowOptions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close options dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowOptions(false);
      }
    }
    if (showOptions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showOptions]);

  return (
    <div ref={containerRef} className={`relative inline-flex items-center gap-1 ${className}`}>
      {/* 1. Main Yin-Yang Rotating Theme Toggle Button */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
        title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode (View Transition: ${variant})`}
        className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-sm flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700/70 transition-all cursor-pointer active:scale-95 group focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        {/* Crisp Yin-Yang SVG with smooth 180deg rotation */}
        <svg
          viewBox="0 0 24 24"
          className={`w-4 h-4 transition-transform duration-500 ${isDark ? 'rotate-180' : 'rotate-0'}`}
        >
          {/* Outer circle: black in light mode, white in dark mode */}
          <circle
            cx="12"
            cy="12"
            r="10"
            className="fill-slate-900 stroke-slate-900 dark:fill-slate-100 dark:stroke-slate-100"
            strokeWidth="1.2"
          />
          {/* S-curve path for the opposite half */}
          <path
            d="M12 2 A10 10 0 0 0 12 22 A5 5 0 0 0 12 12 A5 5 0 0 1 12 2"
            className="fill-white dark:fill-slate-900"
          />
          {/* Upper dot */}
          <circle cx="12" cy="7" r="1.8" className="fill-slate-900 dark:fill-slate-100" />
          {/* Lower dot */}
          <circle cx="12" cy="17" r="1.8" className="fill-white dark:fill-slate-900" />
        </svg>
      </button>

      {/* 2. Options Settings Trigger */}
      <button
        type="button"
        onClick={() => setShowOptions((v) => !v)}
        title="Configure Skiper26 Transition Style"
        className={`w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
          showOptions ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200' : ''
        }`}
      >
        <Sliders className="w-3 h-3" />
      </button>

      {/* 3. Floating Transition Options Popover */}
      <AnimatePresence>
        {showOptions && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-[0_12px_36px_rgba(15,23,42,0.12)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.5)] z-50 p-4 space-y-3.5 text-xs font-sans"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Skiper 26 Transition</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 uppercase">View Transition API</span>
            </div>

            {/* Variant Switcher */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Effect Variant
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {(['circle', 'circle-blur', 'rectangle', 'polygon'] as AnimationVariant[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVariant(v)}
                    className={`px-2.5 py-1.5 rounded-lg text-left text-xs font-mono font-medium flex items-center justify-between transition-all cursor-pointer ${
                      variant === v
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{v}</span>
                    {variant === v && <Check className="w-3 h-3 text-blue-600 dark:text-blue-400" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Origin Start Position */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Origin Anchor
              </span>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    'top-left',
                    'top',
                    'top-right',
                    'left',
                    'center',
                    'right',
                    'bottom-left',
                    'bottom',
                    'bottom-right',
                  ] as AnimationStart[]
                ).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStart(s)}
                    className={`px-1.5 py-1 rounded text-[10px] font-mono font-medium text-center truncate transition-all cursor-pointer ${
                      start === s
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Blur Mask Toggle */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Edge Blur Diffusion
              </span>
              <button
                type="button"
                onClick={() => setBlur(!blur)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  blur ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    blur ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
