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

  return (
    <div className="bg-white border-b border-slate-200/80 p-4 space-y-3 shadow-sm font-sans">
      {/* Top: Smart Queue Presets */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => onSelectPreset('ALL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              preset === 'ALL'
                ? 'bg-blue-600 text-white shadow-sm font-semibold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>All Active Work</span>
          </button>

          <button
            onClick={() => onSelectPreset('UNCLAIMED')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              preset === 'UNCLAIMED'
                ? 'bg-blue-600 text-white shadow-sm font-semibold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-blue-500" />
            <span>Unclaimed Triage</span>
          </button>

          <button
            onClick={() => onSelectPreset('NEEDS_APPROVAL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              preset === 'NEEDS_APPROVAL'
                ? 'bg-violet-600 text-white shadow-sm font-semibold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-violet-500" />
            <span>Pending Approval</span>
          </button>

          <button
            onClick={() => onSelectPreset('MY_ASSIGNED')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              preset === 'MY_ASSIGNED'
                ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>My Assigned</span>
          </button>

          <button
            onClick={() => onSelectPreset('HIGH_PRIORITY')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              preset === 'HIGH_PRIORITY'
                ? 'bg-rose-600 text-white shadow-sm font-semibold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-rose-500" />
            <span>Critical (P0 / P1)</span>
          </button>
        </div>

        {hasActiveFilters && (
          <button
            onClick={onResetFilters}
            className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors px-2 py-1"
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
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search 10k+ items via PostgreSQL tsvector GIN index (title, description)..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-24 py-2 text-xs font-sans text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
            <Clock className="w-3 h-3 text-emerald-600" />
            <span className="text-emerald-700 font-semibold">{lastLatencyMs.toFixed(1)} ms</span>
          </div>
        </div>

        {/* Owning Team Filter */}
        <div className="lg:col-span-2">
          <select
            value={selectedTeam}
            onChange={(e) => onSelectTeam(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
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
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
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
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
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
