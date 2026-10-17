import React from 'react';
import { WorkItemStatus } from '../types';

interface StatusBadgeProps {
  status: WorkItemStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  switch (status) {
    case 'TRIAGE':
      return (
        <span
          className={`inline-flex items-center font-mono font-medium rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 animate-pulse" />
          TRIAGE
        </span>
      );
    case 'INVESTIGATING':
      return (
        <span
          className={`inline-flex items-center font-mono font-medium rounded-full border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
          INVESTIGATING
        </span>
      );
    case 'PENDING_APPROVAL':
      return (
        <span
          className={`inline-flex items-center font-mono font-medium rounded-full border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mr-1.5 animate-pulse" />
          PENDING_APPROVAL
        </span>
      );
    case 'APPROVED':
      return (
        <span
          className={`inline-flex items-center font-mono font-medium rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
          APPROVED
        </span>
      );
    case 'BLOCKED':
      return (
        <span
          className={`inline-flex items-center font-mono font-medium rounded-full border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5" />
          BLOCKED
        </span>
      );
    case 'RESOLVED':
      return (
        <span
          className={`inline-flex items-center font-mono font-medium rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
          RESOLVED
        </span>
      );
    case 'CLOSED':
      return (
        <span
          className={`inline-flex items-center font-mono font-medium rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5" />
          CLOSED
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center font-mono font-medium rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 ${sizeClasses}`}
        >
          {status}
        </span>
      );
  }
};
