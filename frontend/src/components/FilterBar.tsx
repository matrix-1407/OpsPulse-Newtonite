import React from 'react';
import {
  Search,
  Filter,
  Inbox,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  Flame,
  X,
} from 'lucide-react';
import { Team, WorkItemStatus, Priority } from '../types';

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
}) => {
  const hasActiveFilters =
    searchQuery || selectedTeam || selectedStatus || selectedPriority || preset !== 'ALL';

  return (
    <div className="bg-[#0B0F19] border-b border-[#1F2937] p-3 space-y-2.5">
      {/* Smart Queue Presets */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => onSelectPreset('ALL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors border ${
              preset === 'ALL'
                ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                : 'bg-[#111827] text-gray-300 border-[#1F2937] hover:bg-[#1A2234] hover:text-white'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>All Active Work</span>
          </button>

          <button
            onClick={() => onSelectPreset('UNCLAIMED')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors border ${
              preset === 'UNCLAIMED'
                ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                : 'bg-[#111827] text-gray-300 border-[#1F2937] hover:bg-[#1A2234] hover:text-white'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-blue-400" />
            <span>Unclaimed Triage</span>
          </button>

          <button
            onClick={() => onSelectPreset('NEEDS_APPROVAL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors border ${
              preset === 'NEEDS_APPROVAL'
                ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                : 'bg-[#111827] text-gray-300 border-[#1F2937] hover:bg-[#1A2234] hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
            <span>Needs Approval</span>
          </button>

          <button
            onClick={() => onSelectPreset('MY_ASSIGNED')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors border ${
              preset === 'MY_ASSIGNED'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                : 'bg-[#111827] text-gray-300 border-[#1F2937] hover:bg-[#1A2234] hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>My Assigned Items</span>
          </button>

          <button
            onClick={() => onSelectPreset('HIGH_PRIORITY')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors border ${
              preset === 'HIGH_PRIORITY'
                ? 'bg-red-600 text-white border-red-500 shadow-sm'
                : 'bg-[#111827] text-gray-300 border-[#1F2937] hover:bg-[#1A2234] hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-red-400" />
            <span>High Priority (P0 / P1)</span>
          </button>
        </div>

        {hasActiveFilters && (
          <button
            onClick={onResetFilters}
            className="flex items-center gap-1 text-xs font-mono text-gray-400 hover:text-white transition-colors px-2 py-1"
          >
            <X className="w-3 h-3" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Filter Inputs (GIN FTS Search + Team + Status + Priority) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-center">
        {/* Full-Text Search with GIN Index indicator */}
        <div className="lg:col-span-6 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search 10k+ items via PostgreSQL tsvector GIN index (title, description)..."
            className="w-full bg-[#111827] border border-[#1F2937] rounded pl-9 pr-14 py-1.5 text-xs font-sans text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-gray-400 bg-[#1E293B] px-1 py-0.5 rounded border border-gray-700/60">
            GIN FTS
          </span>
        </div>

        {/* Owning Team Filter */}
        <div className="lg:col-span-2">
          <select
            value={selectedTeam}
            onChange={(e) => onSelectTeam(e.target.value)}
            className="w-full bg-[#111827] border border-[#1F2937] rounded px-2.5 py-1.5 text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
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
            className="w-full bg-[#111827] border border-[#1F2937] rounded px-2.5 py-1.5 text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
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
            className="w-full bg-[#111827] border border-[#1F2937] rounded px-2.5 py-1.5 text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
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
