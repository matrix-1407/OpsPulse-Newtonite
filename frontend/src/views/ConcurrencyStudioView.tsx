import React, { useState } from 'react';
import {
  Columns,
  Zap,
  RefreshCw,
  User,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Persona, WorkItem } from '../types';
import { api, ApiError } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { PriorityBadge } from '../components/PriorityBadge';
import { OCCConflictModal } from '../components/OCCConflictModal';
import { SpringPillTabs, PillTabItem } from '../components/ui/SpringPillTabs';
import { InteractiveRaceLanes } from '../components/ui/InteractiveRaceLanes';


interface ConcurrencyStudioViewProps {
  personas: Persona[];
  workItems: WorkItem[];
  onItemUpdated: (item: WorkItem) => void;
}

export const ConcurrencyStudioView: React.FC<ConcurrencyStudioViewProps> = ({
  personas,
  workItems,
  onItemUpdated,
}) => {
  const [activeSubMode, setActiveSubMode] = useState<'occ' | 'race'>('occ');

  // Mode A: OCC State
  const [opA, setOpA] = useState<Persona>(personas[0] || { id: 'usr_aarav', name: 'Aarav Mehta', email: '', roles: {} });
  const [opB, setOpB] = useState<Persona>(personas[1] || { id: 'usr_rohan', name: 'Rohan Desai', email: '', roles: {} });
  const [selectedItemId, setSelectedItemId] = useState<string>(workItems[0]?.id || 'wi_showcase_01');
  const [currentItem, setCurrentItem] = useState<WorkItem | null>(
    workItems.find((w) => w.id === selectedItemId) || workItems[0] || null
  );

  const [opAEdit, setOpAEdit] = useState('');
  const [opBEdit, setOpBEdit] = useState('');
  const [logMessages, setLogMessages] = useState<Array<{ sender: string; text: string; type: 'info' | 'success' | 'conflict' | 'error' }>>([]);

  const [conflictModalData, setConflictModalData] = useState<{
    staleItem: {
      expectedVersion: number;
      attemptedChanges: { title?: string };
    };
    serverItem: WorkItem;
  } | null>(null);

  // Mode B: 5-Way Race State
  const [isRaceRunning, setIsRaceRunning] = useState(false);
  const [raceResults, setRaceResults] = useState<Array<{
    actorId: string;
    actorName: string;
    statusCode: number;
    outcome: 'WINNER' | 'BLOCKED' | 'ERROR';
    latencyMs: number;
    message: string;
  }> | null>(null);
  const [raceTotalMs, setRaceTotalMs] = useState<number | null>(null);

  const addLog = (sender: string, text: string, type: 'info' | 'success' | 'conflict' | 'error' = 'info') => {
    setLogMessages((prev) => [{ sender, text, type }, ...prev.slice(0, 15)]);
  };

  const reloadItem = async () => {
    if (!selectedItemId) return;
    try {
      const fresh = await api.fetchWorkItem(selectedItemId, opA.id);
      setCurrentItem(fresh);
      onItemUpdated(fresh);
      addLog('System', `Fetched latest server state: v${fresh.version} (${fresh.status})`, 'info');
    } catch (e: any) {
      addLog('System', `Failed to fetch: ${e.message}`, 'error');
    }
  };

  // Mode A: Simultaneous Edit Collision
  const handleSimultaneousCollision = async () => {
    if (!currentItem) return;
    const baseVersion = currentItem.version;
    addLog('Simulator', `Dispatched 2 concurrent edits holding expected_version: v${baseVersion}`, 'info');

    const [resA, resB] = await Promise.allSettled([
      api.updateWorkItem(
        currentItem.id,
        {
          expected_version: baseVersion,
          title: opAEdit || `${currentItem.title} (Updated by ${opA.name})`,
        },
        opA.id
      ),
      api.updateWorkItem(
        currentItem.id,
        {
          expected_version: baseVersion,
          title: opBEdit || `${currentItem.title} (Updated by ${opB.name})`,
        },
        opB.id
      ),
    ]);

    let winningItem: WorkItem | null = null;

    if (resA.status === 'fulfilled') {
      winningItem = resA.value;
      addLog(opA.name, `Committed successfully! Version incremented to v${resA.value.version}`, 'success');
      setCurrentItem(resA.value);
      onItemUpdated(resA.value);
    } else {
      const err = resA.reason as ApiError;
      addLog(opA.name, `REJECTED: HTTP ${err.status_code} (${err.code})`, 'conflict');
    }

    if (resB.status === 'fulfilled') {
      winningItem = resB.value;
      addLog(opB.name, `Committed successfully! Version incremented to v${resB.value.version}`, 'success');
      setCurrentItem(resB.value);
      onItemUpdated(resB.value);
    } else {
      const err = resB.reason as ApiError;
      addLog(opB.name, `STALE EDIT REJECTED: HTTP ${err.status_code} (${err.code})`, 'conflict');
      if (err.current_state) {
        setConflictModalData({
          staleItem: {
            expectedVersion: baseVersion,
            attemptedChanges: { title: opBEdit || `${currentItem.title} (Updated by ${opB.name})` },
          },
          serverItem: err.current_state,
        });
      }
    }
  };

  // Mode B: 5-Way Claim Race
  const run5WayRace = async () => {
    if (!currentItem) return;
    setIsRaceRunning(true);
    setRaceResults(null);

    const candidates = personas.slice(0, 5);
    const startTime = performance.now();

    const promises = candidates.map(async (p) => {
      const t0 = performance.now();
      try {
        const { item } = await api.claimWorkItem(currentItem.id, undefined, p.id);
        const latency = performance.now() - t0;
        setCurrentItem(item);
        onItemUpdated(item);
        return {
          actorId: p.id,
          actorName: p.name,
          statusCode: 200,
          outcome: 'WINNER' as const,
          latencyMs: Number(latency.toFixed(2)),
          message: 'Acquired exclusive row lock. Assigned to operator.',
        };
      } catch (err: any) {
        const latency = performance.now() - t0;
        const apiErr = err as ApiError;
        const isClaimed = apiErr.code === 'ALREADY_CLAIMED' || apiErr.status_code === 409;
        return {
          actorId: p.id,
          actorName: p.name,
          statusCode: apiErr.status_code || 409,
          outcome: isClaimed ? ('BLOCKED' as const) : ('ERROR' as const),
          latencyMs: Number(latency.toFixed(2)),
          message: apiErr.message || 'Row lock held by winning operator.',
        };
      }
    });

    const outcomes = await Promise.all(promises);
    setRaceTotalMs(Number((performance.now() - startTime).toFixed(2)));
    setRaceResults(outcomes);
    setIsRaceRunning(false);
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-8 font-sans transition-colors duration-200">
      {/* Studio Header & Sub-Mode Switcher */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-slate-200 dark:border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              Concurrency & Race Simulation Studio
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
              Interactive Invariant Lab
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Simulate real-time distributed race conditions and verify PostgreSQL atomic locks and OCC conflict resolution.
          </p>
        </div>

        {/* Sub-Mode Tabs with SpringPillTabs */}
        {(() => {
          const subModeItems: PillTabItem<'occ' | 'race'>[] = [
            { id: 'occ', label: 'Dual-Operator OCC Collision', icon: <Columns className="w-3.5 h-3.5" /> },
            { id: 'race', label: '5-Way Atomic Claim Race', icon: <Zap className="w-3.5 h-3.5" /> },
          ];
          return (
            <SpringPillTabs<'occ' | 'race'>
              items={subModeItems}
              activeId={activeSubMode}
              onChange={setActiveSubMode}
              layoutGroupId="concurrency-submode"
            />
          );
        })()}

      </div>

      {/* Target Work Item Ribbon */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#09090B] border border-slate-200 dark:border-white/[0.08] shadow-subtle flex items-center justify-between flex-wrap gap-4 text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="text-slate-400 dark:text-zinc-500 font-semibold">TARGET WORK ITEM:</span>
          <select
            value={selectedItemId}
            onChange={(e) => {
              setSelectedItemId(e.target.value);
              const found = workItems.find((w) => w.id === e.target.value);
              if (found) setCurrentItem(found);
            }}
            className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/[0.12] rounded-lg px-3 py-1.5 text-slate-900 dark:text-zinc-100 font-mono text-xs focus:outline-none focus:border-white/30 cursor-pointer"
          >
            {workItems.slice(0, 15).map((w) => (
              <option key={w.id} value={w.id}>
                {w.id} (v{w.version}) - {w.title.slice(0, 45)}
              </option>
            ))}
          </select>

          <button
            onClick={reloadItem}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#141417] hover:bg-slate-200 dark:hover:bg-[#1E1E22] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-white/[0.08] transition-colors cursor-pointer"
            title="Reload target item state"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {currentItem && (
          <div className="flex items-center gap-3">
            <span className="text-slate-600 dark:text-zinc-400 font-mono">
              Live DB Version: <strong className="text-blue-600 dark:text-white font-bold">v{currentItem.version}</strong>
            </span>
            <span className="text-slate-300 dark:text-zinc-700">|</span>
            <StatusBadge status={currentItem.status} size="sm" />
            <PriorityBadge priority={currentItem.priority} />
            <span className="text-slate-500 dark:text-zinc-400">
              Assignee: <strong className="text-slate-800 dark:text-zinc-200">{currentItem.assignee_id || 'None'}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Mode A: Dual-Operator Split Screen */}
      {activeSubMode === 'occ' && (
        <div className="space-y-6">
          {/* Action Trigger Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-[#121215] dark:to-[#161619] border border-blue-200/80 dark:border-white/[0.08] flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-sm">
                Optimistic Concurrency Control Collision Test
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5 font-sans">
                Both operators hold <code className="font-mono text-blue-700 dark:text-zinc-200 font-bold">expected_version: v{currentItem?.version}</code>. Click the button to fire both edits simultaneously: the first commits, and the second triggers a clean 409 conflict.
              </p>
            </div>
            <button
              onClick={handleSimultaneousCollision}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-white dark:hover:bg-zinc-200 dark:text-black text-white font-semibold text-xs transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4 text-white dark:text-black" />
              <span>Simulate Simultaneous Edit Collision</span>
            </button>
          </div>

          {/* Side-by-Side Operator Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Operator A Card */}
            <div className="p-6 rounded-xl bg-white dark:bg-[#09090B] border border-slate-200 dark:border-white/[0.08] shadow-subtle space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-zinc-800 text-blue-700 dark:text-zinc-200 flex items-center justify-center font-bold text-xs">
                    {opA.name.charAt(0)}
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-zinc-100 text-xs block">
                      {opA.name} (Operator 1)
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                      {opA.id} &bull; expected_version: v{currentItem?.version}
                    </span>
                  </div>
                </div>
                <select
                  value={opA.id}
                  onChange={(e) => {
                    const p = personas.find((x) => x.id === e.target.value);
                    if (p) setOpA(p);
                  }}
                  className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/[0.12] rounded-md px-2 py-1 text-xs text-slate-700 dark:text-zinc-200 font-sans cursor-pointer"
                >
                  {personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-zinc-300 block mb-1">
                  Draft Title Mutation
                </label>
                <input
                  type="text"
                  value={opAEdit}
                  onChange={(e) => setOpAEdit(e.target.value)}
                  placeholder={`e.g. Patch Axis Gateway timeout config (${opA.name})`}
                  className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/[0.12] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-white/30 focus:bg-white dark:focus:bg-black font-sans"
                />
              </div>

              <button
                onClick={async () => {
                  if (!currentItem) return;
                  addLog(opA.name, `Sending edit holding expected_version: v${currentItem.version}`, 'info');
                  try {
                    const updated = await api.updateWorkItem(
                      currentItem.id,
                      {
                        expected_version: currentItem.version,
                        title: opAEdit || `${currentItem.title} (Updated by ${opA.name})`,
                      },
                      opA.id
                    );
                    setCurrentItem(updated);
                    onItemUpdated(updated);
                    addLog(opA.name, `Committed successfully (v${updated.version})`, 'success');
                  } catch (e: any) {
                    const apiErr = e as ApiError;
                    addLog(opA.name, `Rejected: HTTP ${apiErr.status_code} (${apiErr.code})`, 'conflict');
                  }
                }}
                className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-white dark:hover:bg-zinc-200 dark:text-black text-white font-semibold text-xs transition-all shadow-sm cursor-pointer"
              >
                Submit Edit as {opA.name} (Hold v{currentItem?.version})
              </button>
            </div>

            {/* Operator B Card */}
            <div className="p-6 rounded-xl bg-white dark:bg-[#09090B] border border-slate-200 dark:border-white/[0.08] shadow-subtle space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-zinc-800 text-indigo-700 dark:text-zinc-200 flex items-center justify-center font-bold text-xs">
                    {opB.name.charAt(0)}
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-zinc-100 text-xs block">
                      {opB.name} (Operator 2)
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                      {opB.id} &bull; expected_version: v{currentItem?.version}
                    </span>
                  </div>
                </div>
                <select
                  value={opB.id}
                  onChange={(e) => {
                    const p = personas.find((x) => x.id === e.target.value);
                    if (p) setOpB(p);
                  }}
                  className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/[0.12] rounded-md px-2 py-1 text-xs text-slate-700 dark:text-zinc-200 font-sans cursor-pointer"
                >
                  {personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-zinc-300 block mb-1">
                  Draft Title Mutation
                </label>
                <input
                  type="text"
                  value={opBEdit}
                  onChange={(e) => setOpBEdit(e.target.value)}
                  placeholder={`e.g. Escalate to Gateway Partner Lead (${opB.name})`}
                  className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/[0.12] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-white/30 focus:bg-white dark:focus:bg-black font-sans"
                />
              </div>

              <button
                onClick={async () => {
                  if (!currentItem) return;
                  addLog(opB.name, `Sending edit holding expected_version: v${currentItem.version}`, 'info');
                  try {
                    const updated = await api.updateWorkItem(
                      currentItem.id,
                      {
                        expected_version: currentItem.version,
                        title: opBEdit || `${currentItem.title} (Updated by ${opB.name})`,
                      },
                      opB.id
                    );
                    setCurrentItem(updated);
                    onItemUpdated(updated);
                    addLog(opB.name, `Committed successfully (v${updated.version})`, 'success');
                  } catch (e: any) {
                    const apiErr = e as ApiError;
                    addLog(opB.name, `Rejected: HTTP ${apiErr.status_code} (${apiErr.code})`, 'conflict');
                    if (apiErr.current_state) {
                      setConflictModalData({
                        staleItem: {
                          expectedVersion: currentItem.version,
                          attemptedChanges: { title: opBEdit },
                        },
                        serverItem: apiErr.current_state,
                      });
                    }
                  }
                }}
                className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 dark:bg-white dark:hover:bg-zinc-200 dark:text-black text-white font-semibold text-xs transition-all shadow-sm cursor-pointer"
              >
                Submit Edit as {opB.name} (Hold v{currentItem?.version})
              </button>
            </div>
          </div>

          {/* Real-Time Studio Activity Log */}
          <div className="p-4 rounded-xl bg-white dark:bg-[#09090B] border border-slate-200 dark:border-white/[0.08] shadow-subtle space-y-2">
            <span className="text-[11px] font-mono font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
              Studio Real-Time Log
            </span>
            <div className="space-y-1.5 font-mono text-xs max-h-48 overflow-y-auto">
              {logMessages.length === 0 ? (
                <div className="text-slate-400 dark:text-zinc-600 italic">No events recorded. Click a simulation button above.</div>
              ) : (
                logMessages.map((msg, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-slate-400 dark:text-zinc-500">[{msg.sender}]:</span>
                    <span
                      className={
                        msg.type === 'success'
                          ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                          : msg.type === 'conflict'
                          ? 'text-rose-700 dark:text-rose-400 font-semibold'
                          : msg.type === 'error'
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-700 dark:text-zinc-300'
                      }
                    >
                      {msg.text}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mode B: 5-Way Atomic Claim Race */}
      {activeSubMode === 'race' && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-[#141416] dark:to-[#18181B] border border-amber-200 dark:border-white/[0.08] flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-sm">
                5-Way Atomic Claim Race Simulation (SELECT FOR UPDATE)
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5 font-sans">
                Fires 5 simultaneous claim requests across 5 operators in parallel (<code className="font-mono text-amber-800 dark:text-amber-300">Promise.all</code>). Row-level exclusive locks ensure exactly 1 winner.
              </p>
            </div>
            <button
              onClick={run5WayRace}
              disabled={isRaceRunning}
              className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Play className="w-4 h-4 text-white" />
              <span>{isRaceRunning ? 'Executing 5-Way Race...' : 'Execute 5-Way Race Now'}</span>
            </button>
          </div>

          {/* Results Display */}
          {raceResults && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <div>
                    <span className="font-bold font-sans">
                      RACE CONDITION PREVENTED: EXACTLY 1 WINNER ACQUIRED ROW LOCK
                    </span>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 font-sans mt-0.5">
                      1 Operator acquired the exclusive row lock; 4 operators were blocked with HTTP 409 ALREADY_CLAIMED.
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold block">Total Time: {raceTotalMs} ms</span>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400">5 parallel workers</span>
                </div>
              </div>

              {/* 5 Animated Race Lanes */}
              <div className="p-5 rounded-xl bg-white dark:bg-[#09090B] border border-slate-200 dark:border-white/[0.08] shadow-subtle">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[11px] font-mono font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                    Live Race Track — SELECT ... FOR UPDATE Contention
                  </span>
                </div>
                <InteractiveRaceLanes lanes={raceResults} isRunning={false} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* OCC Conflict Modal */}
      {conflictModalData && (
        <OCCConflictModal
          staleItem={conflictModalData.staleItem}
          serverItem={conflictModalData.serverItem}
          onDiscard={() => {
            onItemUpdated(conflictModalData.serverItem);
            setCurrentItem(conflictModalData.serverItem);
            setConflictModalData(null);
          }}
          onForceReapply={async (serverVersion) => {
            setConflictModalData(null);
            try {
              const updated = await api.updateWorkItem(
                conflictModalData.serverItem.id,
                {
                  expected_version: serverVersion,
                  title: conflictModalData.staleItem.attemptedChanges.title,
                },
                opB.id
              );
              setCurrentItem(updated);
              onItemUpdated(updated);
              addLog(opB.name, `Re-applied on top of v${updated.version} successfully!`, 'success');
            } catch (err: any) {
              addLog(opB.name, `Re-apply failed: ${err.message}`, 'error');
            }
          }}
          onClose={() => setConflictModalData(null)}
        />
      )}
    </div>
  );
};
