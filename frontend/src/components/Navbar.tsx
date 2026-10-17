import React, { useState } from 'react';
import {
  Activity,
  Users,
  Plus,
  ShieldCheck,
  ChevronDown,
  LayoutDashboard,
  Layers,
  Zap,
  BarChart3,
} from 'lucide-react';
import { Persona } from '../types';
import { SpringPillTabs, PillTabItem } from './ui/SpringPillTabs';
import { DynamicTelemetryIsland } from './ui/DynamicTelemetryIsland';
import { ThemeToggleButton } from './ui/SkiperThemeToggle';

export type NavTab = 'overview' | 'workspace' | 'concurrency' | 'benchmarks';

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  personas: Persona[];
  activePersona: Persona;
  onSelectPersona: (p: Persona) => void;
  onOpenCreate: () => void;
  totalItems?: number;
  lastQueryLatencyMs?: number;
}

const NAV_ITEMS: PillTabItem<NavTab>[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
  { id: 'workspace', label: 'Workspace', icon: <Layers className="w-3.5 h-3.5" /> },
  { id: 'concurrency', label: 'Concurrency Studio', icon: <Zap className="w-3.5 h-3.5" /> },
  { id: 'benchmarks', label: 'Benchmarks & Telemetry', icon: <BarChart3 className="w-3.5 h-3.5" /> },
];

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  personas,
  activePersona,
  onSelectPersona,
  onOpenCreate,
  totalItems = 10015,
  lastQueryLatencyMs = 3.42,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/85 dark:bg-[#0B0F19]/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-6 font-sans transition-colors duration-200">
      <div className="max-w-[1600px] h-full mx-auto flex items-center justify-between gap-6">
        {/* Left: Brand & Emblem */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => onSelectTab('overview')}
            className="cursor-pointer flex items-center gap-2.5"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <Activity className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-slate-100 text-base tracking-tight">
                OpsPulse
              </span>
            </div>
          </div>
        </div>

        {/* Center: 4 Spring Pill Navigation Tabs */}
        <nav>
          <SpringPillTabs<NavTab>
            items={NAV_ITEMS}
            activeId={currentTab}
            onChange={onSelectTab}
            layoutGroupId="main-nav"
            size="sm"
          />
        </nav>

        {/* Right: Telemetry Island + Theme Toggle + New Request + Persona Switcher */}
        <div className="flex items-center gap-3">
          {/* Dynamic Telemetry Island */}
          <DynamicTelemetryIsland
            totalItems={totalItems}
            lastQueryLatencyMs={lastQueryLatencyMs}
          />

          {/* Skiper26 View Transition Theme Toggle Button */}
          <ThemeToggleButton />

          {/* Create New Work Item Button */}
          <button
            onClick={onOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white transition-all shadow-sm hover:shadow cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Request</span>
          </button>

          {/* Persona Switcher Pill */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700 transition-all shadow-sm cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-xs font-mono font-bold text-blue-700 dark:text-blue-300">
                {activePersona.name.charAt(0)}
              </div>
              <div className="text-left hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-slate-900 dark:text-slate-100">
                    {activePersona.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                    ({activePersona.id})
                  </span>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            </button>

            {/* Persona Switcher Popover */}
            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-popover z-50 py-2">
                  <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    <span className="text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      Active Persona Context (X-Actor-Id)
                    </span>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
                    {personas.map((p) => {
                      const isSelected = p.id === activePersona.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            onSelectPersona(p);
                            setDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors flex flex-col gap-1 cursor-pointer ${
                            isSelected ? 'bg-blue-50/50 dark:bg-blue-950/40 border-l-2 border-blue-600' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                              {p.name}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                              {p.id}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {p.email}
                          </div>

                          {/* Role Badges */}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(p.roles || {}).map(([team, role]) => (
                              <span
                                key={team}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                                  role === 'APPROVER' || role === 'LEAD'
                                    ? 'bg-violet-50 dark:bg-violet-950/60 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300'
                                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
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
