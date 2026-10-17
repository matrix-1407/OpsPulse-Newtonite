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

export type NavTab = 'overview' | 'workspace' | 'concurrency' | 'benchmarks';

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  personas: Persona[];
  activePersona: Persona;
  onSelectPersona: (p: Persona) => void;
  onOpenCreate: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  personas,
  activePersona,
  onSelectPersona,
  onOpenCreate,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const navItems = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
    { id: 'workspace' as const, label: 'Workspace', icon: Layers },
    { id: 'concurrency' as const, label: 'Concurrency Studio', icon: Zap },
    { id: 'benchmarks' as const, label: 'Benchmarks & Telemetry', icon: BarChart3 },
  ];

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/85 backdrop-blur-md border-b border-slate-200/80 px-6 font-sans">
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
              <span className="font-bold text-slate-900 text-base tracking-tight">
                OpsPulse
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-slate-100 text-slate-600 border border-slate-200">
                v2.4 Enterprise
              </span>
            </div>
          </div>
        </div>

        {/* Center: 4 Clean Top-Level Navigation Tabs */}
        <nav className="flex items-center bg-slate-100/80 p-1 rounded-lg border border-slate-200/60">
          {navItems.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Persona Switcher & New Request Action */}
        <div className="flex items-center gap-3">
          {/* Create New Work Item Button */}
          <button
            onClick={onOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-sm hover:shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Request</span>
          </button>

          {/* Persona Switcher Pill */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 px-2.5 py-1 rounded-full bg-white hover:bg-slate-50 border border-slate-200/80 transition-all shadow-sm"
            >
              <div className="w-6 h-6 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-xs font-mono font-bold text-blue-700">
                {activePersona.name.charAt(0)}
              </div>
              <div className="text-left hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-slate-900">
                    {activePersona.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    ({activePersona.id})
                  </span>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Persona Switcher Popover */}
            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white border border-slate-200 shadow-popover z-50 py-2">
                  <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-mono font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3 h-3 text-blue-600" />
                      Active Persona Context (X-Actor-Id)
                    </span>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {personas.map((p) => {
                      const isSelected = p.id === activePersona.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            onSelectPersona(p);
                            setDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2.5 hover:bg-slate-50 transition-colors flex flex-col gap-1 ${
                            isSelected ? 'bg-blue-50/50 border-l-2 border-blue-600' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-900">
                              {p.name}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              {p.id}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {p.email}
                          </div>

                          {/* Role Badges */}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(p.roles || {}).map(([team, role]) => (
                              <span
                                key={team}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                                  role === 'APPROVER' || role === 'LEAD'
                                    ? 'bg-violet-50 border-violet-200 text-violet-700'
                                    : 'bg-slate-100 border-slate-200 text-slate-600'
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
