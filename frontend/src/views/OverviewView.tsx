import React from 'react';
import {
  ArrowRight,
  Database,
  Clock,
  ShieldCheck,
  Send,
  Layers,
  Zap,
  CheckCircle2,
  FileCheck2,
  BarChart3,
  Sparkles,
} from 'lucide-react';
import { NavTab } from '../components/Navbar';
import { QueuePreset } from '../components/FilterBar';

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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-mono font-medium shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Newtonite Systems Engineering &mdash; Operational Coordination Engine</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Reliable Operational Coordination Under Concurrency.
        </h1>

        <p className="text-base text-slate-600 font-sans leading-relaxed">
          Designed for high-growth teams managing tens of thousands of active operational requests with strict optimistic concurrency control, atomic claiming, idempotent retries, and deterministic approval workflows.
        </p>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => onNavigate('workspace')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-sm hover:shadow transition-all"
          >
            <span>Open Operations Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigate('benchmarks')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs border border-slate-200 shadow-sm transition-all"
          >
            <BarChart3 className="w-4 h-4 text-slate-500" />
            <span>View Benchmark Telemetry</span>
          </button>
        </div>
      </section>

      {/* 2. Live System Pulse Strip (4 Minimalist Metric Cards) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-white border border-slate-200/80 shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono">
            <span>ACTIVE DATASET SCALE</span>
            <Database className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {totalItems.toLocaleString()}+
            </span>
            <p className="text-xs text-slate-500 mt-1">
              PostgreSQL 16 B-Tree & GIN <code className="text-slate-700 font-mono">tsvector</code> indexed
            </p>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200/80 shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono">
            <span>KEYSET SEEK LATENCY</span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-emerald-600">
              ~{lastLatencyMs.toFixed(1)} ms
            </span>
            <p className="text-xs text-slate-500 mt-1">
              Deterministic <code className="text-slate-700 font-mono">O(1)</code> cursor vs <code className="text-slate-700 font-mono">O(N)</code> OFFSET
            </p>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200/80 shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono">
            <span>CONCURRENCY INVARIANTS</span>
            <ShieldCheck className="w-4 h-4 text-violet-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-slate-900">
              5 Active Guards
            </span>
            <p className="text-xs text-slate-500 mt-1">
              OCC, Row-Locks, Advisory Locks, SoD, Outbox
            </p>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200/80 shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono">
            <span>TRANSACTIONAL OUTBOX</span>
            <Send className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-slate-900">
              100% ACID Enqueued
            </span>
            <p className="text-xs text-slate-500 mt-1">
              <code className="text-slate-700 font-mono">SKIP LOCKED</code> async dispatch (Zero Redis)
            </p>
          </div>
        </div>
      </section>

      {/* 3. Interactive Feature Routing Grid ("Explore Core Capabilities") */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Explore Core Architectural Capabilities
          </h2>
          <p className="text-xs text-slate-500">
            Directly test how OpsPulse protects operational integrity under heavy concurrency.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Capability 1: Triage & Keyset Queue */}
          <div className="p-6 rounded-xl bg-white border border-slate-200/80 shadow-subtle hover:border-slate-300 transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                1. Triage Queue & Deterministic Keyset Pagination
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Browse through 10,015 operational requests using sub-5ms PostgreSQL <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">tsvector</code> GIN full-text search. Navigate deeply using <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">(updated_at, id)</code> composite B-Tree indexes without memory pagination cliffs.
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 mt-4">
              <button
                onClick={() => onNavigate('workspace', 'UNCLAIMED')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                <span>Launch Unclaimed Triage Queue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Capability 2: Atomic Claim & OCC Conflict Resolver */}
          <div className="p-6 rounded-xl bg-white border border-slate-200/80 shadow-subtle hover:border-slate-300 transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                2. Atomic Claiming & OCC Conflict Resolution
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Experience row-level exclusive locks (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">SELECT ... FOR UPDATE</code>) preventing duplicate claims, and Optimistic Concurrency Control rejecting stale updates with interactive side-by-side merge resolution.
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 mt-4">
              <button
                onClick={() => onNavigate('concurrency')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors"
              >
                <span>Launch Concurrency Studio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Capability 3: Separation of Duties & Approval Gate */}
          <div className="p-6 rounded-xl bg-white border border-slate-200/80 shadow-subtle hover:border-slate-300 transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-100">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                3. Separation of Duties & Approval Gatekeeper
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Deterministic state machine preventing illegal status transitions. Resolving high-risk requests is locked until peer approval is granted. Self-approval by assignees or creators is rejected at the domain layer with structured RFC error policies.
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 mt-4">
              <button
                onClick={() => onNavigate('workspace', 'NEEDS_APPROVAL')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700 transition-colors"
              >
                <span>View Items Requiring Approval</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Capability 4: Live PostgreSQL Benchmark Suite */}
          <div className="p-6 rounded-xl bg-white border border-slate-200/80 shadow-subtle hover:border-slate-300 transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                4. Live Concurrency & Scale Stress Suite
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Trigger real-time execution of the production micro-benchmark suite: 20x GIN search iterations (p50/p95/p99), Keyset vs Offset 5000 speedup factor, 8-way concurrent claim race, and SKIP LOCKED outbox throughput.
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 mt-4">
              <button
                onClick={() => onNavigate('benchmarks')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                <span>Open Benchmark Telemetry</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
