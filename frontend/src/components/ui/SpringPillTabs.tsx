import React from 'react';
import { motion } from 'framer-motion';

export interface PillTabItem<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

interface SpringPillTabsProps<T extends string> {
  items: PillTabItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  layoutGroupId: string;
  size?: 'sm' | 'md';
}

export function SpringPillTabs<T extends string>({
  items,
  activeId,
  onChange,
  layoutGroupId,
  size = 'md',
}: SpringPillTabsProps<T>) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100/90 dark:bg-black p-1 border border-slate-200/80 dark:border-white/[0.08]">
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`relative z-10 inline-flex items-center gap-2 rounded-lg font-medium transition-colors duration-150 select-none cursor-pointer ${
              size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-1.5 text-sm'
            } ${isActive ? 'text-slate-900 dark:text-zinc-100' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'}`}
          >
            {isActive && (
              <motion.span
                layoutId={`nav-pill-${layoutGroupId}`}
                className="absolute inset-0 -z-10 rounded-lg bg-white dark:bg-[#1A1A1E] shadow-[0_1px_3px_rgba(15,23,42,0.08)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.8)] ring-1 ring-slate-900/5 dark:ring-white/10"
                transition={{ type: 'spring', stiffness: 450, damping: 34, mass: 0.7 }}
              />
            )}
            {item.icon && <span className="shrink-0">{item.icon}</span>}
            <span>{item.label}</span>
            {item.badge !== undefined && (
              <span
                className={`ml-0.5 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                  isActive ? 'bg-blue-50 text-blue-700 dark:bg-zinc-800 dark:text-zinc-200' : 'bg-slate-200/70 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400'
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
