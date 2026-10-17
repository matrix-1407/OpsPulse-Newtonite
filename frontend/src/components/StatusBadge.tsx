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
          className={`inline-flex items-center font-mono font-medium rounded-full border border-blue-200 bg-blue-50 text-blue-700 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 animate-pulse" />
          TRIAGE
        </span>
      );
    case 'INVESTIGATING':
      return (
        <span
          className={`inline-flex items-center font-mono font-medium rounded-full border border-amber-200 bg-amber-50 text-amber-700 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
          INVESTIGATING
        </span>
      );
    case 'PENDING_APPROVAL':
      return (
        <span
          className={`inline-flex items-center font-mono font-medium rounded-full border border-violet-200 bg-violet-50 text-violet-700 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mr-1.5 animate-pulse" />
          PENDING_APPROVAL
        </span>
      );
    case 'APPROVED':
      return (
        <span
          className={`inline-flex items-center font-mono font-medium rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
          APPROVED
        </span>
      );
    case 'BLOCKED':
      return (
        <span
          className={`inline-flex items-center font-mono font-medium rounded-full border border-rose-200 bg-rose-50 text-rose-700 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5" />
          BLOCKED
        </span>
      );
    case 'RESOLVED':
      return (
        <span
          className={`inline-flex items-center font-mono font-medium rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
          RESOLVED
        </span>
      );
    case 'CLOSED':
      return (
        <span
          className={`inline-flex items-center font-mono font-medium rounded-full border border-slate-200 bg-slate-100 text-slate-600 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5" />
          CLOSED
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center font-mono font-medium rounded-full border border-slate-200 bg-slate-100 text-slate-600 ${sizeClasses}`}
        >
          {status}
        </span>
      );
  }
};
