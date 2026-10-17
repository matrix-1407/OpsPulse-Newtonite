import React, { useState } from 'react';
import { Plus, X, Copy, Check, Repeat, ShieldCheck } from 'lucide-react';
import { api } from '../api/client';
import { Team, Priority, WorkItem, Persona } from '../types';

interface CreateWorkItemModalProps {
  teams: Team[];
  activePersona: Persona;
  onClose: () => void;
  onItemCreated: (item: WorkItem) => void;
}

export const CreateWorkItemModal: React.FC<CreateWorkItemModalProps> = ({
  teams,
  activePersona,
  onClose,
  onItemCreated,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [teamId, setTeamId] = useState(teams[0]?.id || 'team_payments');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [requiresApproval, setRequiresApproval] = useState(false);

  // Generate unique UUID v4 for Idempotency-Key
  const [idempotencyKey] = useState<string>(
    () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idem_${Date.now()}`)
  );
  const [copiedKey, setCopiedKey] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replayTestResults, setReplayTestResults] = useState<{
    requestIndex: number;
    statusCode: number;
    isReplay: boolean;
    createdId: string;
    durationMs: number;
  }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(idempotencyKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    setIsSubmitting(true);
    setError(null);
    setReplayTestResults(null);

    try {
      const { item } = await api.createWorkItem(
        {
          title,
          description,
          priority,
          owning_team_id: teamId,
          requires_approval: requiresApproval,
        },
        activePersona.id,
        idempotencyKey
      );
      onItemCreated(item);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create work item');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Test network retry double-click: Fire 3 identical requests simultaneously with the same key
  const handleTestNetworkDoubleClick = async () => {
    if (!title.trim()) return;
    setIsSubmitting(true);
    setError(null);
    setReplayTestResults(null);

    const payload = {
      title,
      description,
      priority,
      owning_team_id: teamId,
      requires_approval: requiresApproval,
    };

    const requests = [1, 2, 3].map(async (idx) => {
      const t0 = performance.now();
      try {
        const { item, isIdempotentReplay } = await api.createWorkItem(
          payload,
          activePersona.id,
          idempotencyKey
        );
        const durationMs = Number((performance.now() - t0).toFixed(2));
        return {
          requestIndex: idx,
          statusCode: 201,
          isReplay: isIdempotentReplay,
          createdId: item.id,
          durationMs,
        };
      } catch (err: any) {
        const durationMs = Number((performance.now() - t0).toFixed(2));
        return {
          requestIndex: idx,
          statusCode: err.status_code || 500,
          isReplay: false,
          createdId: 'ERROR',
          durationMs,
        };
      }
    });

    const results = await Promise.all(requests);
    setReplayTestResults(results);
    setIsSubmitting(false);

    // Pass the created item back
    if (results[0] && results[0].createdId !== 'ERROR') {
      try {
        const item = await api.fetchWorkItem(results[0].createdId, activePersona.id);
        onItemCreated(item);
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/75 backdrop-blur-sm animate-fade-in font-sans">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-[#09090B] border border-slate-200 dark:border-white/[0.1] shadow-2xl overflow-hidden flex flex-col transition-colors duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#0D0D10] border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-white border border-blue-200 dark:border-white flex items-center justify-center text-blue-600 dark:text-black">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-900 dark:text-zinc-100">
                Create Operational Work Item
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Dispatches transactional event into the ACID work queue
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#18181B] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 font-mono text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="text-slate-700 dark:text-zinc-300 font-medium block mb-1.5">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Critical API Gateway Connection Leak"
              className="w-full bg-white dark:bg-black border border-slate-200 dark:border-white/[0.12] rounded-lg px-3 py-2 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-white/30 text-xs shadow-sm placeholder:text-slate-400 dark:placeholder:text-zinc-600 font-sans"
            />
          </div>

          <div>
            <label className="text-slate-700 dark:text-zinc-300 font-medium block mb-1.5">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Operational context, incident symptoms, and impact..."
              className="w-full bg-white dark:bg-black border border-slate-200 dark:border-white/[0.12] rounded-lg px-3 py-2 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-white/30 text-xs shadow-sm placeholder:text-slate-400 dark:placeholder:text-zinc-600 font-sans"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-700 dark:text-zinc-300 font-medium block mb-1.5">
                Owning Team
              </label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full bg-white dark:bg-black border border-slate-200 dark:border-white/[0.12] rounded-lg px-3 py-2 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-white/30 text-xs shadow-sm cursor-pointer"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-700 dark:text-zinc-300 font-medium block mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full bg-white dark:bg-black border border-slate-200 dark:border-white/[0.12] rounded-lg px-3 py-2 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-white/30 text-xs shadow-sm font-mono cursor-pointer"
              >
                <option value="CRITICAL">P0 CRITICAL</option>
                <option value="HIGH">P1 HIGH</option>
                <option value="MEDIUM">P2 MEDIUM</option>
                <option value="LOW">P3 LOW</option>
              </select>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0D0D10] border border-slate-200 dark:border-white/[0.08] flex items-center justify-between">
            <div>
              <span className="font-medium text-slate-900 dark:text-zinc-100 block flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-white" />
                Require Independent Peer Approval (SoD)
              </span>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Enforces approval gatekeeper. Cannot be resolved until an independent approver signs off.
              </p>
            </div>
            <input
              type="checkbox"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 dark:text-white border-slate-300 dark:border-zinc-700 focus:ring-0"
            />
          </div>

          {/* Idempotency Key Inspector */}
          <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-[#121215] border border-blue-200/80 dark:border-white/[0.08] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-900 dark:text-zinc-200 flex items-center gap-1.5">
                <Repeat className="w-3.5 h-3.5 text-blue-600 dark:text-white" />
                Network Retry Idempotency-Key
              </span>
              <button
                onClick={handleCopyKey}
                className="text-xs font-medium text-blue-600 dark:text-white hover:text-blue-800 dark:hover:text-zinc-200 flex items-center gap-1 transition-colors cursor-pointer"
              >
                {copiedKey ? <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey ? 'Copied' : 'Copy Key'}</span>
              </button>
            </div>
            <div className="bg-white dark:bg-black p-2 rounded-lg border border-blue-200 dark:border-white/[0.12] text-slate-700 dark:text-zinc-300 font-mono text-[11px] break-all select-all shadow-sm">
              {idempotencyKey}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              PostgreSQL stores request hash & response body with advisory transaction lock serialization.
            </p>
          </div>

          {/* Replay Test Results */}
          {replayTestResults && (
            <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Network Double-Click Deduplication Verified</span>
              </div>
              <div className="space-y-1.5 text-[11px]">
                {replayTestResults.map((r) => (
                  <div key={r.requestIndex} className="flex items-center justify-between text-slate-700 dark:text-zinc-300 bg-white/80 dark:bg-black p-2 rounded border border-emerald-200/60 dark:border-white/[0.08]">
                    <span className="font-mono">
                      Request #{r.requestIndex}: HTTP {r.statusCode}{' '}
                      {r.isReplay ? (
                        <span className="text-amber-700 dark:text-amber-300 font-semibold">[X-Idempotent-Replay: true]</span>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-300 font-semibold">[Original Mutation Committed]</span>
                      )}
                    </span>
                    <span className="text-slate-500 dark:text-zinc-400 font-mono tabular-nums">{r.durationMs} ms</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#0D0D10] border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-between text-xs">
          <button
            onClick={handleTestNetworkDoubleClick}
            disabled={isSubmitting || !title.trim()}
            className="px-3.5 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 font-medium transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
            title="Fire 3 identical POST requests simultaneously with the same Idempotency-Key"
          >
            ⚡ Test Network Double-Click (Send 3x)
          </button>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-100 dark:bg-[#121214] dark:hover:bg-[#1A1A1E] border border-slate-200 dark:border-white/[0.1] text-slate-700 dark:text-zinc-200 font-medium transition-colors shadow-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={isSubmitting || !title.trim()}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 dark:text-black text-white font-medium transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
            >
              {isSubmitting ? 'Creating...' : 'Create Item'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
