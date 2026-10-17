import React, { useState } from 'react';
import {
  Activity,
  Users,
  Zap,
  Columns,
  Plus,
  ShieldCheck,
  ChevronDown,
  Database,
  Clock,
} from 'lucide-react';
import { Persona } from '../types';

interface NavbarProps {
  personas: Persona[];
  activePersona: Persona;
  onSelectPersona: (p: Persona) => void;
  totalItems: number;
  lastQueryLatencyMs: number;
  onOpenBenchmark: () => void;
  isDualView: boolean;
  onToggleDualView: () => void;
  onOpenCreate: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  personas,
  activePersona,
  onSelectPersona,
  totalItems,
  lastQueryLatencyMs,
  onOpenBenchmark,
  isDualView,
  onToggleDualView,
  onOpenCreate,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-[#0B0F19] border-b border-[#1F2937] px-4 py-2.5">
      <div className="max-w-[1720px] mx-auto flex items-center justify-between gap-4">
        {/* Brand & Engine Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Activity className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold tracking-tight text-base text-white">
                  OpsPulse
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-blue-950/70 border border-blue-800/60 text-blue-300">
                  Postgres 16 ACID
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-sans hidden sm:block">
                High-Concurrency Operations Cockpit
              </p>
            </div>
          </div>

          <div className="h-6 w-px bg-[#1F2937] mx-1 hidden md:block" />

          {/* Database Scale & Search Latency Pill */}
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded bg-[#111827] border border-[#1F2937] text-xs font-mono">
            <div className="flex items-center gap-1.5 text-gray-300">
              <Database className="w-3.5 h-3.5 text-blue-400" />
              <span>
                <strong className="text-white">{totalItems.toLocaleString()}+</strong> items
              </span>
            </div>
            <span className="text-gray-600">|</span>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Clock className="w-3.5 h-3.5" />
              <span className="tabular-nums">
                {lastQueryLatencyMs.toFixed(2)} ms
              </span>
              <span className="text-[10px] text-gray-400 font-sans">(GIN / Keyset)</span>
            </div>
          </div>
        </div>

        {/* Right Section: Persona Switcher & Tool Triggers */}
        <div className="flex items-center gap-2.5">
          {/* Dual-Operator Split View Toggle */}
          <button
            onClick={onToggleDualView}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono transition-colors border ${
              isDualView
                ? 'bg-amber-950/60 border-amber-600 text-amber-300'
                : 'bg-[#111827] border-[#1F2937] text-gray-300 hover:bg-[#1A2234] hover:text-white'
            }`}
            title="Toggle Dual-Operator Split View to simulate concurrent race conditions side-by-side"
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Dual-Operator Split</span>
          </button>

          {/* Concurrency & Benchmark Lab Modal Button */}
          <button
            onClick={onOpenBenchmark}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 border border-blue-700/60 transition-colors shadow-sm"
          >
            <Zap className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Concurrency Lab</span>
          </button>

          {/* New Work Item Modal Button */}
          <button
            onClick={onOpenCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Task</span>
          </button>

          <div className="h-6 w-px bg-[#1F2937] mx-1" />

          {/* Multi-Persona Switcher */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-[#111827] hover:bg-[#161F30] border border-[#1F2937] transition-colors text-left"
            >
              <div className="w-6 h-6 rounded-full bg-blue-900/80 border border-blue-500/60 flex items-center justify-center text-xs font-mono font-bold text-blue-200">
                {activePersona.name.charAt(0)}
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-white">
                    {activePersona.name}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">
                    ({activePersona.id})
                  </span>
                </div>
                {/* Team role badge preview */}
                <div className="flex items-center gap-1 mt-0.5">
                  {Object.entries(activePersona.roles || {}).slice(0, 2).map(([team, role]) => (
                    <span
                      key={team}
                      className="px-1 py-0.2 rounded text-[9px] font-mono bg-[#1E293B] text-gray-300 border border-gray-700/50"
                    >
                      {team.replace('team_', '').toUpperCase()}: {role}
                    </span>
                  ))}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-1" />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-72 rounded-lg bg-[#0F172A] border border-[#1F2937] shadow-2xl z-50 py-1.5 font-sans">
                  <div className="px-3 py-2 border-b border-[#1F2937]">
                    <div className="text-[11px] font-mono text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3 h-3 text-blue-400" />
                      Select Operator Persona (X-Actor-Id)
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-gray-800/40">
                    {personas.map((p) => {
                      const isSelected = p.id === activePersona.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            onSelectPersona(p);
                            setDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2.5 hover:bg-[#1E293B] transition-colors flex flex-col gap-1 ${
                            isSelected ? 'bg-blue-950/40 border-l-2 border-blue-500' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-white">
                              {p.name}
                            </span>
                            <span className="text-[10px] font-mono text-gray-400">
                              {p.id}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-400 truncate">
                            {p.email}
                          </div>

                          {/* Role Badges */}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(p.roles || {}).map(([team, role]) => (
                              <span
                                key={team}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                                  role === 'APPROVER' || role === 'LEAD'
                                    ? 'bg-purple-950/60 border-purple-700/60 text-purple-300'
                                    : 'bg-slate-900 border-slate-700 text-slate-300'
                                }`}
                              >
                                <ShieldCheck className="w-2.5 h-2.5 inline mr-0.5" />
                                {team.replace('team_', '').toUpperCase()}: {role}
                              </span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
