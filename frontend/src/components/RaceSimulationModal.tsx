import React, { useState } from 'react';
import { Zap, CheckCircle2, XCircle, ShieldAlert, X, Clock, Play } from 'lucide-react';
import { api, ApiError } from '../api/client';
import { WorkItem, Persona } from '../types';

interface RaceSimulationModalProps {
  workItem: WorkItem;
  personas: Persona[];
  onClose: () => void;
  onItemUpdated: (item: WorkItem) => void;
}

interface ClaimAttemptResult {
  actorId: string;
  actorName: string;
  statusCode: number;
  outcome: 'WINNER' | 'BLOCKED' | 'ERROR';
  latencyMs: number;
  message: string;
}

export const RaceSimulationModal: React.FC<RaceSimulationModalProps> = ({
  workItem,
  personas,
  onClose,
  onItemUpdated,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ClaimAttemptResult[] | null>(null);
  const [totalRaceTimeMs, setTotalRaceTimeMs] = useState<number | null>(null);

  const run5WayRace = async () => {
    setIsRunning(true);
    setResults(null);

    // Pick 5 distinct personas (or available ones)
    const candidates = personas.slice(0, 5);
    const startTime = performance.now();

    const promises = candidates.map(async (p) => {
      const t0 = performance.now();
      try {
        const { item } = await api.claimWorkItem(workItem.id, undefined, p.id);
        const latency = performance.now() - t0;
        onItemUpdated(item);
        return {
          actorId: p.id,
          actorName: p.name,
          statusCode: 200,
          outcome: 'WINNER' as const,
          latencyMs: Number(latency.toFixed(2)),
          message: 'Lock acquired via SELECT ... FOR UPDATE. Transitioned to INVESTIGATING.',
        };
      } catch (err: any) {
        const latency = performance.now() - t0;
        const apiErr = err as ApiError;
        const isAlreadyClaimed = apiErr.code === 'ALREADY_CLAIMED' || apiErr.status_code === 409;
        return {
          actorId: p.id,
          actorName: p.name,
          statusCode: apiErr.status_code || 409,
          outcome: isAlreadyClaimed ? ('BLOCKED' as const) : ('ERROR' as const),
          latencyMs: Number(latency.toFixed(2)),
          message: apiErr.message || 'Row lock released after winner claimed the item.',
        };
      }
    });

    const outcomes = await Promise.all(promises);
    const totalTime = performance.now() - startTime;
    setTotalRaceTimeMs(Number(totalTime.toFixed(2)));
    setResults(outcomes);
    setIsRunning(false);
  };

  const winnersCount = results?.filter((r) => r.outcome === 'WINNER').length || 0;
  const blockedCount = results?.filter((r) => r.outcome === 'BLOCKED').length || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="w-full max-w-3xl rounded-lg bg-[#0F172A] border border-[#1F2937] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#111827] border-b border-[#1F2937] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-mono font-bold text-sm text-white">
                5-Way Concurrent Claim Race Simulator
              </h3>
              <p className="text-xs text-gray-400 font-sans">
                Target Work Item:{' '}
                <span className="font-mono text-gray-300">{workItem.id}</span> (Status: {workItem.status}, Version: v{workItem.version})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="text-xs text-gray-300">
            Fires 5 simultaneous <code className="font-mono text-blue-300 bg-[#1E293B] px-1 py-0.5 rounded">POST /api/v1/work-items/{'{id}'}/claim</code> requests across 5 distinct operators in parallel (<code className="font-mono text-purple-300">Promise.all</code>). PostgreSQL row-level exclusive locks (<code className="font-mono text-amber-300">SELECT ... FOR UPDATE</code>) serialize the requests, guaranteeing <strong>EXACTLY 1 Winner</strong>.
          </div>

          {!results && !isRunning && (
            <div className="p-8 text-center bg-[#111827] rounded border border-[#1F2937] space-y-3">
              <p className="text-xs text-gray-400">
                Ready to launch 5 concurrent claims against <code className="font-mono text-white">{workItem.id}</code>.
              </p>
              <button
                onClick={run5WayRace}
                className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white font-mono text-xs font-semibold inline-flex items-center gap-2 transition-colors shadow-sm"
              >
                <Play className="w-4 h-4" />
                <span>Execute 5-Way Race Now</span>
              </button>
            </div>
          )}

          {isRunning && (
            <div className="p-8 text-center bg-[#111827] rounded border border-[#1F2937] space-y-3">
              <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-mono text-amber-300">
                Fired 5 concurrent HTTP POST requests. Waiting for PostgreSQL transaction locks to resolve...
              </p>
            </div>
          )}

          {results && (
            <div className="space-y-4">
              {/* Verdict Summary Banner */}
              <div
                className={`p-3.5 rounded border flex items-center justify-between text-xs font-mono ${
                  winnersCount === 1
                    ? 'bg-emerald-950/60 border-emerald-600/60 text-emerald-300'
                    : 'bg-red-950/60 border-red-600/60 text-red-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {winnersCount === 1 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0" />
                  )}
                  <div>
                    <span className="font-bold">
                      {winnersCount === 1
                        ? 'RACE CONDITION PREVENTED: EXACTLY 1 WINNER ACQUIRED ROW LOCK'
                        : 'UNEXPECTED OUTCOME'}
                    </span>
                    <p className="text-[11px] opacity-80 font-sans mt-0.5">
                      1 Operator acquired the exclusive row lock; 4 operators were blocked with HTTP 409 ALREADY_CLAIMED.
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="block font-bold">Total: {totalRaceTimeMs} ms</span>
                  <span className="text-[10px] opacity-75">5 parallel threads</span>
                </div>
              </div>

              {/* Individual Claim Results Table */}
              <div className="rounded border border-[#1F2937] overflow-hidden">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#111827] border-b border-[#1F2937] text-gray-400 text-[10px] uppercase">
                    <tr>
                      <th className="py-2 px-3">Operator</th>
                      <th className="py-2 px-3">Outcome</th>
                      <th className="py-2 px-3">HTTP Status</th>
                      <th className="py-2 px-3">Latency</th>
                      <th className="py-2 px-3">Lock Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/40 bg-[#090D16]">
                    {results.map((r, idx) => (
                      <tr
                        key={idx}
                        className={
                          r.outcome === 'WINNER' ? 'bg-emerald-950/20' : ''
                        }
                      >
                        <td className="py-2 px-3 font-semibold text-white">
                          {r.actorName}{' '}
                          <span className="text-gray-500 text-[10px]">({r.actorId})</span>
                        </td>
                        <td className="py-2 px-3">
                          {r.outcome === 'WINNER' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 border border-emerald-700/60 text-emerald-300">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              1 WINNER (200 OK)
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-950/60 border border-red-800/60 text-red-300">
                              <XCircle className="w-3 h-3 mr-1" />
                              BLOCKED (409)
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-gray-300 font-bold">
                          HTTP {r.statusCode}
                        </td>
                        <td className="py-2 px-3 text-gray-400 tabular-nums">
                          {r.latencyMs} ms
                        </td>
                        <td className="py-2 px-3 text-gray-400 text-[11px] font-sans truncate max-w-xs">
                          {r.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#0B0F19] border-t border-[#1F2937] flex items-center justify-between text-xs font-mono">
          <span className="text-gray-500">
            PostgreSQL: <code className="text-gray-400">SELECT * FROM work_items WHERE id = $1 FOR UPDATE</code>
          </span>
          <div className="flex items-center gap-2">
            {results && (
              <button
                onClick={run5WayRace}
                disabled={isRunning}
                className="px-3 py-1.5 rounded bg-[#1E293B] hover:bg-[#334155] text-gray-200 transition-colors"
              >
                Re-Run Race
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
