import React from 'react';
import {
  Clock,
  ArrowRight,
  RotateCcw,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
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
  nextCursor,
  hasMore,
  onNextPage,
  onResetPagination,
  queryTimeMs,
  isLoading,
}) => {
  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#090D16]">
      {/* Table Container */}
      <div className="flex-1 overflow-auto border-b border-[#1F2937]">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-[#0F172A] border-b border-[#1F2937] text-gray-400 font-mono text-[11px] uppercase tracking-wider">
            <tr>
              <th className="py-2.5 px-3 font-semibold">ID</th>
              <th className="py-2.5 px-3 font-semibold">Version</th>
              <th className="py-2.5 px-3 font-semibold">Title & Description</th>
              <th className="py-2.5 px-3 font-semibold">Team</th>
              <th className="py-2.5 px-3 font-semibold">Priority</th>
              <th className="py-2.5 px-3 font-semibold">Status</th>
              <th className="py-2.5 px-3 font-semibold">Assignee</th>
              <th className="py-2.5 px-3 font-semibold text-right">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/40 font-sans">
            {isLoading && items.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-gray-400 font-mono">
                  <div className="inline-flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                    Executing Keyset B-Tree Index Query...
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-gray-500 font-mono">
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
                    className={`cursor-pointer transition-colors hover:bg-[#111827] ${
                      isSelected
                        ? 'bg-[#151D2F] border-l-2 border-l-blue-500'
                        : ''
                    }`}
                  >
                    {/* Item ID */}
                    <td className="py-2 px-3 font-mono text-gray-300 font-medium whitespace-nowrap">
                      {item.id}
                    </td>

                    {/* Version Badge (OCC) */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#1E293B] text-blue-300 border border-blue-900/40">
                        v{item.version}
                      </span>
                    </td>

                    {/* Title & Approval Requirement */}
                    <td className="py-2 px-3 max-w-md">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-white truncate max-w-sm">
                          {item.title}
                        </span>
                        {item.requires_approval && (
                          <span
                            className="inline-flex items-center text-[10px] font-mono text-purple-400 bg-purple-950/40 px-1 rounded border border-purple-800/40 flex-shrink-0"
                            title="Requires independent peer approval before resolution"
                          >
                            <ShieldCheck className="w-2.5 h-2.5 mr-0.5" />
                            APPROVAL_REQ
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-[11px] text-gray-400 truncate max-w-sm font-sans mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </td>

                    {/* Owning Team */}
                    <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px] text-gray-300">
                      {item.owning_team_id.replace('team_', '').toUpperCase()}
                    </td>

                    {/* Priority */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <PriorityBadge priority={item.priority} />
                    </td>

                    {/* Status */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <StatusBadge status={item.status} size="sm" />
                    </td>

                    {/* Assignee */}
                    <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px]">
                      {item.assignee_id ? (
                        <span className="inline-flex items-center gap-1 text-gray-200">
                          <User className="w-3 h-3 text-blue-400" />
                          <span>{item.assignee_name || item.assignee_id}</span>
                        </span>
                      ) : (
                        <span className="text-gray-500 italic">Unassigned</span>
                      )}
                    </td>

                    {/* Updated At */}
                    <td className="py-2 px-3 text-right font-mono text-[11px] text-gray-400 whitespace-nowrap">
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
      <div className="bg-[#0B0F19] px-4 py-2 flex items-center justify-between text-xs font-mono text-gray-400 border-t border-[#1F2937]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Clock className="w-3.5 h-3.5" />
            <span className="tabular-nums">
              DB Query: {queryTimeMs.toFixed(2)} ms
            </span>
            <span className="text-[10px] text-gray-500 font-sans">
              (Keyset B-Tree O(1) Index Seek)
            </span>
          </div>
          <span className="text-gray-600">|</span>
          <span>Showing {items.length} items in view</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onResetPagination}
            disabled={isLoading}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#111827] hover:bg-[#1A2234] border border-[#1F2937] text-gray-300 disabled:opacity-40 transition-colors"
            title="Reset cursor back to the top of the queue"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset to Top</span>
          </button>

          <button
            onClick={onNextPage}
            disabled={!hasMore || isLoading}
            className="flex items-center gap-1 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-40 disabled:bg-[#1E293B] disabled:text-gray-500 transition-colors"
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
