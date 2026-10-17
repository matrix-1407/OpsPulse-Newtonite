import React from 'react';
import {
  Search,
  Inbox,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  Flame,
  X,
  Clock,
} from 'lucide-react';
import { Team } from '../types';
import { SpringPillTabs, PillTabItem } from './ui/SpringPillTabs';


export type QueuePreset =
  | 'ALL'
  | 'UNCLAIMED'
  | 'NEEDS_APPROVAL'
  | 'MY_ASSIGNED'
  | 'HIGH_PRIORITY';

interface FilterBarProps {
  preset: QueuePreset;
  onSelectPreset: (preset: QueuePreset) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  teams: Team[];
  selectedTeam: string;
  onSelectTeam: (teamId: string) => void;
  selectedStatus: string;
  onSelectStatus: (status: string) => void;
  selectedPriority: string;
  onSelectPriority: (priority: string) => void;
  onResetFilters: () => void;
  lastLatencyMs: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  preset,
  onSelectPreset,
  searchQuery,
  onSearchChange,
  teams,
  selectedTeam,
  onSelectTeam,
  selectedStatus,
  onSelectStatus,
  selectedPriority,
  onSelectPriority,
  onResetFilters,
  lastLatencyMs,
}) => {
  const hasActiveFilters =
    searchQuery || selectedTeam || selectedStatus || selectedPriority || preset !== 'ALL';

  const presetItems: PillTabItem<QueuePreset>[] = [
    { id: 'ALL', label: 'All Active Work', icon: <Inbox className="w-3.5 h-3.5" /> },
    { id: 'UNCLAIMED', label: 'Unclaimed Triage', icon: <AlertCircle className="w-3.5 h-3.5" /> },
    { id: 'NEEDS_APPROVAL', label: 'Pending Approval', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    { id: 'MY_ASSIGNED', label: 'My Assigned', icon: <UserCheck className="w-3.5 h-3.5" /> },
    { id: 'HIGH_PRIORITY', label: 'Critical (P0 / P1)', icon: <Flame className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="bg-white dark:bg-[#0E1526] border-b border-slate-200/80 dark:border-slate-800 p-4 space-y-3 shadow-sm font-sans transition-colors duration-200">
      {/* Top: Smart Queue Presets via SpringPillTabs */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="overflow-x-auto">
          <SpringPillTabs<QueuePreset>
            items={presetItems}
            activeId={preset}
            onChange={onSelectPreset}
            layoutGroupId="workspace-presets"
            size="sm"
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={onResetFilters}
            className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors px-2 py-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Bottom: Search & Filter Dropdowns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-center">
        {/* Full-Text Search with GIN Index latency indicator */}
        <div className="lg:col-span-6 relative">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search 10k+ items via PostgreSQL tsvector GIN index (title, description)..."
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-24 py-2 text-xs font-sans text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
            <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{lastLatencyMs.toFixed(1)} ms</span>
          </div>
        </div>

        {/* Owning Team Filter */}
        <div className="lg:col-span-2">
          <select
            value={selectedTeam}
            onChange={(e) => onSelectTeam(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all cursor-pointer"
          >
            <option value="">All Teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="lg:col-span-2">
          <select
            value={selectedStatus}
            onChange={(e) => onSelectStatus(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="TRIAGE">TRIAGE</option>
            <option value="INVESTIGATING">INVESTIGATING</option>
            <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
            <option value="APPROVED">APPROVED</option>
            <option value="BLOCKED">BLOCKED</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </div>

        {/* Priority Filter */}
        <div className="lg:col-span-2">
          <select
            value={selectedPriority}
            onChange={(e) => onSelectPriority(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all cursor-pointer"
          >
            <option value="">All Priorities</option>
            <option value="CRITICAL">P0 CRITICAL</option>
            <option value="HIGH">P1 HIGH</option>
            <option value="MEDIUM">P2 MEDIUM</option>
            <option value="LOW">P3 LOW</option>
          </select>
        </div>
      </div>
    </div>
  );
};
