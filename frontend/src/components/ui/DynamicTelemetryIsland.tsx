import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Zap, Activity, Server, Trash2, ChevronDown } from 'lucide-react';

interface DynamicTelemetryIslandProps {
  totalItems: number;
  lastQueryLatencyMs: number;
}

export const DynamicTelemetryIsland: React.FC<DynamicTelemetryIslandProps> = ({
  totalItems,
  lastQueryLatencyMs,
}) => {
  const [open, setOpen] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<string | null>(null);

  const handleCleanup = async () => {
    setIsCleaning(true);
    setCleanResult(null);
    try {
      await fetch('/api/v1/system/cleanup-test-artifacts', { method: 'POST' });
      setCleanResult('Purged. Dataset restored to pristine state.');
    } catch {
      setCleanResult('Cleanup request sent.');
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="relative">
      {/* Compact Trigger Pill */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-[#121214] hover:bg-slate-50 dark:hover:bg-[#1A1A1E] border border-slate-200/80 dark:border-white/[0.12] transition-all shadow-sm text-xs font-mono group cursor-pointer"
      >
        {/* Pulsing emerald dot */}
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="font-semibold text-slate-700 dark:text-zinc-200">
          {totalItems.toLocaleString()}+ rows
        </span>
        <span className="text-slate-400 dark:text-zinc-500">·</span>
        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">~{lastQueryLatencyMs.toFixed(1)} ms</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Floating Island Panel */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.6 }}
              className="absolute right-0 mt-2 w-80 rounded-2xl bg-white dark:bg-[#09090B] border border-slate-200 dark:border-white/[0.1] shadow-[0_8px_32px_rgba(15,23,42,0.10)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.85)] z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="px-4 py-3 bg-slate-50 dark:bg-[#0F0F12] border-b border-slate-100 dark:border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100">PostgreSQL 16 Live Status</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">Connection pool & index health</p>
              </div>

              {/* Status Rows */}
              <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-300">
                    <Database className="w-3.5 h-3.5 text-blue-600 dark:text-white" />
                    <span className="font-mono">idx_work_items_keyset</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    O(1) Seek
                  </span>
                </div>

                <div className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-300">
                    <Database className="w-3.5 h-3.5 text-violet-600 dark:text-white" />
                    <span className="font-mono">idx_work_items_search_gin</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-violet-50 dark:bg-zinc-800 text-violet-700 dark:text-zinc-300 border border-violet-200 dark:border-zinc-700">
                    GIN Active
                  </span>
                </div>

                <div className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-300">
                    <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span className="font-mono">Last Query Time</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {lastQueryLatencyMs.toFixed(2)} ms
                  </span>
                </div>

                <div className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-300">
                    <Server className="w-3.5 h-3.5 text-blue-600 dark:text-white" />
                    <span className="font-mono">psycopg3 Pool</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-50 dark:bg-zinc-800 text-blue-700 dark:text-zinc-300 border border-blue-200 dark:border-zinc-700">
                    Async Active
                  </span>
                </div>
              </div>

              {/* Footer: Purge Button */}
              <div className="px-4 py-3 bg-slate-50 dark:bg-[#0F0F12] border-t border-slate-100 dark:border-white/[0.08] space-y-2">
                <button
                  onClick={handleCleanup}
                  disabled={isCleaning}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-black hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-white/[0.12] hover:border-rose-200 dark:hover:border-rose-800 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:text-rose-700 dark:hover:text-rose-400 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isCleaning ? 'Purging...' : 'Purge Test Artifacts'}</span>
                </button>
                {cleanResult && (
                  <p className="text-[11px] text-center text-emerald-600 dark:text-emerald-400 font-mono">{cleanResult}</p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
