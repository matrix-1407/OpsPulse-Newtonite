import React from 'react';
import { Priority } from '../types';

interface PriorityBadgeProps {
  priority: Priority;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
  switch (priority) {
    case 'CRITICAL':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-red-950/80 text-red-300 border border-red-700/60 shadow-sm">
          P0 CRITICAL
        </span>
      );
    case 'HIGH':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-amber-950/70 text-amber-300 border border-amber-700/60">
          P1 HIGH
        </span>
      );
    case 'MEDIUM':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-blue-950/50 text-blue-300 border border-blue-800/40">
          P2 MEDIUM
        </span>
      );
    case 'LOW':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-slate-900 text-slate-400 border border-slate-700/40">
          P3 LOW
        </span>
      );
  }
};
