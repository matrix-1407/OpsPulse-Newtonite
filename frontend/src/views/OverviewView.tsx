import React from 'react';
import {
  ArrowRight,
  Database,
  Clock,
  ShieldCheck,
  Send,
  Layers,
  Zap,
  FileCheck2,
  BarChart3,
  Sparkles,
} from 'lucide-react';
import { NavTab } from '../components/Navbar';
import { QueuePreset } from '../components/FilterBar';
import { SpotlightBentoCard } from '../components/ui/SpotlightBentoCard';
import { AnimatedMetricTicker } from '../components/ui/AnimatedMetricTicker';

interface OverviewViewProps {
  onNavigate: (tab: NavTab, preset?: QueuePreset) => void;
  totalItems: number;
  lastLatencyMs: number;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  onNavigate,
  totalItems,
  lastLatencyMs,
}) => {
  return (
    <div className="space-y-10 py-6 max-w-[1400px] mx-auto px-6">
      {/* 1. Hero Header */}
      <section className="text-center max-w-3xl mx-auto space-y-4 pt-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-100 dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/[0.1] text-slate-800 dark:text-zinc-200 text-xs font-mono font-medium shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-zinc-300" />
          <span>Newtonite Systems Engineering &mdash; Operational Coordination Engine</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight leading-tight">
          Reliable Operational Coordination Under Concurrency.
        </h1>

        <p className="text-base text-slate-600 dark:text-zinc-400 font-sans leading-relaxed">
          Designed for high-growth teams managing tens of thousands of active operational requests with strict optimistic concurrency control, atomic claiming, idempotent retries, and deterministic approval workflows.
        </p>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => onNavigate('workspace')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-white dark:hover:bg-zinc-200 dark:text-black text-white font-medium text-xs shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <span>Open Operations Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigate('benchmarks')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white dark:bg-[#121214] hover:bg-slate-50 dark:hover:bg-[#1A1A1E] text-slate-700 dark:text-zinc-200 font-medium text-xs border border-slate-200 dark:border-white/[0.1] shadow-sm transition-all cursor-pointer"
          >
            <BarChart3 className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
            <span>View Benchmark Telemetry</span>
          </button>
        </div>
      </section>

      {/* 2. Live System Pulse Strip (4 Spotlight Bento Metric Cards) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SpotlightBentoCard spotlightColor="rgba(255, 255, 255, 0.05)">
          <div className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-mono">
              <span>ACTIVE DATASET SCALE</span>
              <Database className="w-4 h-4 text-blue-600 dark:text-zinc-300" />
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-zinc-100">
                <AnimatedMetricTicker value={totalItems} suffix="+" />
              </span>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                PostgreSQL 16 B-Tree & GIN <code className="text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-[#18181B] px-1 py-0.5 rounded font-mono">tsvector</code> indexed
              </p>
            </div>
          </div>
        </SpotlightBentoCard>

        <SpotlightBentoCard spotlightColor="rgba(16, 185, 129, 0.08)">
          <div className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-mono">
              <span>KEYSET SEEK LATENCY</span>
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                ~<AnimatedMetricTicker value={lastLatencyMs} decimals={1} suffix=" ms" />
              </span>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Deterministic <code className="text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-[#18181B] px-1 py-0.5 rounded font-mono">O(1)</code> cursor vs <code className="text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-[#18181B] px-1 py-0.5 rounded font-mono">O(N)</code> OFFSET
              </p>
            </div>
          </div>
        </SpotlightBentoCard>

        <SpotlightBentoCard spotlightColor="rgba(124, 58, 237, 0.08)">
          <div className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-mono">
              <span>CONCURRENCY INVARIANTS</span>
              <ShieldCheck className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-zinc-100">
                <AnimatedMetricTicker value={5} suffix=" Active Guards" />
              </span>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                OCC, Row-Locks, Advisory Locks, SoD, Outbox
              </p>
            </div>
          </div>
        </SpotlightBentoCard>

        <SpotlightBentoCard spotlightColor="rgba(217, 119, 6, 0.08)">
          <div className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-mono">
              <span>TRANSACTIONAL OUTBOX</span>
              <Send className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-zinc-100">
                100% ACID Enqueued
              </span>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                <code className="text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-[#18181B] px-1 py-0.5 rounded font-mono">SKIP LOCKED</code> async dispatch (Zero Redis)
              </p>
            </div>
          </div>
        </SpotlightBentoCard>
      </section>

      {/* 3. Interactive Feature Routing Grid ("Explore Core Capabilities") */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
            Explore Core Architectural Capabilities
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Directly test how OpsPulse protects operational integrity under heavy concurrency.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Capability 1: Triage & Keyset Queue */}
          <SpotlightBentoCard
            onClick={() => onNavigate('workspace', 'UNCLAIMED')}
            spotlightColor="rgba(255, 255, 255, 0.04)"
          >
            <div className="p-6 flex flex-col justify-between h-full">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-zinc-900 text-blue-600 dark:text-zinc-200 flex items-center justify-center border border-blue-100 dark:border-white/[0.08]">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                  1. Triage Queue & Deterministic Keyset Pagination
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Browse through 10,015 operational requests using sub-5ms PostgreSQL <code className="font-mono bg-slate-100 dark:bg-[#18181B] px-1 py-0.5 rounded text-slate-700 dark:text-zinc-300">tsvector</code> GIN full-text search. Navigate deeply using <code className="font-mono bg-slate-100 dark:bg-[#18181B] px-1 py-0.5 rounded text-slate-700 dark:text-zinc-300">(updated_at, id)</code> composite B-Tree indexes without memory pagination cliffs.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-white/[0.08] mt-4">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-zinc-200 hover:text-blue-700 dark:hover:text-white transition-colors">
                  <span>Launch Unclaimed Triage Queue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </SpotlightBentoCard>

          {/* Capability 2: Atomic Claim & OCC Conflict Resolver */}
          <SpotlightBentoCard
            onClick={() => onNavigate('concurrency')}
            spotlightColor="rgba(217, 119, 6, 0.08)"
          >
            <div className="p-6 flex flex-col justify-between h-full">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-zinc-900 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-white/[0.08]">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                  2. Atomic Claiming & OCC Conflict Resolution
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Experience row-level exclusive locks (<code className="font-mono bg-slate-100 dark:bg-[#18181B] px-1 py-0.5 rounded text-slate-700 dark:text-zinc-300">SELECT ... FOR UPDATE</code>) preventing duplicate claims, and Optimistic Concurrency Control rejecting stale updates with interactive side-by-side merge resolution.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-white/[0.08] mt-4">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors">
                  <span>Launch Concurrency Studio</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </SpotlightBentoCard>

          {/* Capability 3: Separation of Duties & Approval Gate */}
          <SpotlightBentoCard
            onClick={() => onNavigate('workspace', 'NEEDS_APPROVAL')}
            spotlightColor="rgba(124, 58, 237, 0.08)"
          >
            <div className="p-6 flex flex-col justify-between h-full">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-violet-50 dark:bg-zinc-900 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-100 dark:border-white/[0.08]">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                  3. Separation of Duties & Approval Gatekeeper
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Deterministic state machine preventing illegal status transitions. Resolving high-risk requests is locked until peer approval is granted. Self-approval by assignees or creators is rejected at the domain layer with structured RFC error policies.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-white/[0.08] mt-4">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors">
                  <span>View Items Requiring Approval</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </SpotlightBentoCard>

          {/* Capability 4: Live PostgreSQL Benchmark Suite */}
          <SpotlightBentoCard
            onClick={() => onNavigate('benchmarks')}
            spotlightColor="rgba(16, 185, 129, 0.08)"
          >
            <div className="p-6 flex flex-col justify-between h-full">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-white/[0.08]">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                  4. Live Concurrency & Scale Stress Suite
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Trigger real-time execution of the production micro-benchmark suite: 20x GIN search iterations (p50/p95/p99), Keyset vs Offset 5000 speedup factor, 8-way concurrent claim race, and SKIP LOCKED outbox throughput.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-white/[0.08] mt-4">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
                  <span>Open Benchmark Telemetry</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </SpotlightBentoCard>
        </div>
      </section>
    </div>
  );
};
