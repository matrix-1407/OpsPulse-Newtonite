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
    <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 p-1 border border-slate-200/80 dark:border-slate-700/80">
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`relative z-10 inline-flex items-center gap-2 rounded-lg font-medium transition-colors duration-150 select-none cursor-pointer ${
              size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-1.5 text-sm'
            } ${isActive ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
          >
            {isActive && (
              <motion.span
                layoutId={`skiper-pill-${layoutGroupId}`}
                className="absolute inset-0 -z-10 rounded-lg bg-white dark:bg-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.08)] dark:shadow-[0_1px_4px_rgba(0,0,0,0.5)] ring-1 ring-slate-900/5 dark:ring-white/10"
                transition={{ type: 'spring', stiffness: 450, damping: 34, mass: 0.7 }}
              />
            )}
            {item.icon && <span className="shrink-0">{item.icon}</span>}
            <span>{item.label}</span>
            {item.badge !== undefined && (
              <span
                className={`ml-0.5 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                  isActive ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'bg-slate-200/70 dark:bg-slate-700/80 text-slate-600 dark:text-slate-400'
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
