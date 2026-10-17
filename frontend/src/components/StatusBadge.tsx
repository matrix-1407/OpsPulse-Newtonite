import React from 'react';
import { WorkItemStatus } from '../types';

interface StatusBadgeProps {
  status: WorkItemStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  switch (status) {
    case 'TRIAGE':
      return (
        <span
          className={`inline-flex items-center font-mono font-medium rounded border border-blue-500/30 bg-blue-950/40 text-blue-400 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5 animate-pulse" />
          TRIAGE
        </span>
      );
    case 'INVESTIGATING':
      return (
        <span
          className={`inline-flex items-center font-mono font-medium rounded border border-amber-500/30 bg-amber-950/40 text-amber-400 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5" />
          INVESTIGATING
        </span>
      );
    case 'PENDING_APPROVAL':
      return (
        <span
          className={`inline-flex items-center font-mono font-medium rounded border border-purple-500/30 bg-purple-950/40 text-purple-300 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mr-1.5 animate-pulse" />
          PENDING_APPROVAL
        </span>
      );
    case 'APPROVED':
      return (
        <span
          className={`inline-flex items-center font-mono font-medium rounded border border-emerald-500/30 bg-emerald-950/40 text-emerald-300 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" />
          APPROVED
        </span>
      );
    case 'BLOCKED':
      return (
        <span
          className={`inline-flex items-center font-mono font-medium rounded border border-red-500/30 bg-red-950/40 text-red-400 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />
          BLOCKED
        </span>
      );
    case 'RESOLVED':
      return (
        <span
          className={`inline-flex items-center font-mono font-medium rounded border border-emerald-600/40 bg-emerald-900/30 text-emerald-400 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" />
          RESOLVED
        </span>
      );
    case 'CLOSED':
      return (
        <span
          className={`inline-flex items-center font-mono font-medium rounded border border-gray-600/40 bg-gray-900/50 text-gray-400 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-gray-500 mr-1.5" />
          CLOSED
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center font-mono font-medium rounded border border-gray-700 bg-gray-800 text-gray-300 ${sizeClasses}`}
        >
          {status}
        </span>
      );
  }
};
