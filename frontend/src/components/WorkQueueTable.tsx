import React from 'react';
import {
  Clock,
  ArrowRight,
  RotateCcw,
  ShieldCheck,
  User,
} from 'lucide-react';
import { WorkItem } from '../types';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';

interface WorkQueueTableProps {
  items: WorkItem[];
  selectedItem: WorkItem | null;
  onSelectItem: (item: WorkItem) => void;
  nextCursor?: string | null;
  hasMore: boolean;
  onNextPage: () => void;
  onResetPagination: () => void;
  queryTimeMs: number;
  isLoading: boolean;
}

export const WorkQueueTable: React.FC<WorkQueueTableProps> = ({
  items,
  selectedItem,
  onSelectItem,
  hasMore,
  onNextPage,
  onResetPagination,
  queryTimeMs,
  isLoading,
}) => {
  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-black transition-colors duration-200">
      {/* Table Container */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-slate-50/90 dark:bg-[#0A0A0C]/95 backdrop-blur-sm border-b border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-zinc-400 font-mono text-[11px] uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4 font-semibold">ID</th>
              <th className="py-3 px-4 font-semibold">Version</th>
              <th className="py-3 px-4 font-semibold">Operational Incident / Request</th>
              <th className="py-3 px-4 font-semibold">Team</th>
              <th className="py-3 px-4 font-semibold">Priority</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold">Assignee</th>
              <th className="py-3 px-4 font-semibold text-right">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05] font-sans">
            {isLoading && items.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-slate-500 dark:text-zinc-400 font-mono">
                  <div className="inline-flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-white animate-ping" />
                    Executing Keyset B-Tree Index Seek...
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-20 text-center text-slate-400 dark:text-zinc-500 font-mono">
                  No work items match current filter criteria.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                return (
                  <tr
                    key={item.id}
                    onClick={() => onSelectItem(item)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50/70 dark:bg-[#141418] border-l-2 border-l-blue-600 dark:border-l-white'
                        : 'hover:bg-slate-50/80 dark:hover:bg-[#111113]'
                    }`}
                  >
                    {/* Item ID */}
                    <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-zinc-400 font-medium whitespace-nowrap">
                      {item.id}
                    </td>

                    {/* Version Badge (OCC) */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 dark:bg-[#161619] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/[0.08]">
                        v{item.version}
                      </span>
                    </td>

                    {/* Title & Approval Requirement */}
                    <td className="py-3.5 px-4 max-w-md">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-zinc-100 truncate max-w-sm">
                          {item.title}
                        </span>
                        {item.requires_approval && (
                          <span
                            className="inline-flex items-center text-[10px] font-mono font-medium text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40 px-1.5 py-0.5 rounded border border-violet-200 dark:border-violet-800/80 flex-shrink-0"
                            title="Requires independent peer approval before resolution"
                          >
                            <ShieldCheck className="w-3 h-3 mr-1" />
                            APPROVAL_REQ
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate max-w-sm font-sans mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </td>

                    {/* Owning Team */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-slate-600 dark:text-zinc-400">
                      {item.owning_team_id.replace('team_', '').toUpperCase()}
                    </td>

                    {/* Priority */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <PriorityBadge priority={item.priority} />
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusBadge status={item.status} size="sm" />
                    </td>

                    {/* Assignee */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-sans text-xs">
                      {item.assignee_id ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-800 dark:text-zinc-200">
                          <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-[#1C1C20] text-slate-700 dark:text-zinc-200 flex items-center justify-center text-[10px] font-bold font-mono">
                            {(item.assignee_name || item.assignee_id).charAt(0)}
                          </div>
                          <span>{item.assignee_name || item.assignee_id}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-zinc-500 italic">Unassigned</span>
                      )}
                    </td>

                    {/* Updated At */}
                    <td className="py-3.5 px-4 text-right font-mono text-[11px] text-slate-400 dark:text-zinc-500 whitespace-nowrap">
                      {new Date(item.updated_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Keyset Cursor Pagination & DB Metric Footer */}
      <div className="bg-slate-50/80 dark:bg-[#0A0A0C]/95 px-5 py-3 flex items-center justify-between text-xs font-mono text-slate-500 dark:text-zinc-400 border-t border-slate-200 dark:border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
            <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="tabular-nums font-semibold">
              Query Time: {queryTimeMs.toFixed(2)} ms
            </span>
            <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-sans">
              (Keyset B-Tree O(1) Index Seek)
            </span>
          </div>
          <span className="text-slate-300 dark:text-zinc-700">|</span>
          <span>Showing {items.length} items</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onResetPagination}
            disabled={isLoading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white dark:bg-[#121214] hover:bg-slate-100 dark:hover:bg-[#1A1A1E] border border-slate-200 dark:border-white/[0.1] text-slate-700 dark:text-zinc-200 font-medium disabled:opacity-40 transition-colors shadow-sm cursor-pointer"
            title="Reset cursor back to the top of the queue"
          >
            <RotateCcw className="w-3 h-3 text-slate-500 dark:text-zinc-400" />
            <span>Reset to Top</span>
          </button>

          <button
            onClick={onNextPage}
            disabled={!hasMore || isLoading}
            className="flex items-center gap-1 px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 dark:bg-white dark:hover:bg-zinc-200 dark:text-black text-white font-medium disabled:opacity-40 disabled:bg-slate-200 dark:disabled:bg-zinc-800 disabled:text-slate-400 dark:disabled:text-zinc-500 transition-colors shadow-sm cursor-pointer"
            title="Fetch next keyset page using (updated_at, id) cursor"
          >
            <span>Next Page (Cursor)</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
