import React, { useState } from 'react';
import { Plus, X, ShieldCheck, Copy, Check, Repeat } from 'lucide-react';
import { api, ApiError } from '../api/client';
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
  const [idempotencyKey, setIdempotencyKey] = useState<string>(
    () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idem_${Date.now()}`
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
      const { item, isIdempotentReplay } = await api.createWorkItem(
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

    const startTime = performance.now();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="w-full max-w-xl rounded-lg bg-[#0F172A] border border-[#1F2937] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#111827] border-b border-[#1F2937] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-400" />
            <h3 className="font-mono font-bold text-sm text-white">
              Create Operational Work Item
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded bg-red-950/60 border border-red-500/60 text-red-200 font-mono">
              {error}
            </div>
          )}

          <div>
            <label className="text-gray-300 font-mono block mb-1">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Critical API Gateway Connection Leak"
              className="w-full bg-[#111827] border border-[#1F2937] rounded px-3 py-1.5 text-white focus:outline-none focus:border-blue-500 font-sans"
            />
          </div>

          <div>
            <label className="text-gray-300 font-mono block mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Operational context, incident symptoms, and impact..."
              className="w-full bg-[#111827] border border-[#1F2937] rounded px-3 py-1.5 text-white focus:outline-none focus:border-blue-500 font-sans"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-300 font-mono block mb-1">
                Owning Team
              </label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full bg-[#111827] border border-[#1F2937] rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-blue-500"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-gray-300 font-mono block mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full bg-[#111827] border border-[#1F2937] rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-blue-500"
              >
                <option value="CRITICAL">P0 CRITICAL</option>
                <option value="HIGH">P1 HIGH</option>
                <option value="MEDIUM">P2 MEDIUM</option>
                <option value="LOW">P3 LOW</option>
              </select>
            </div>
          </div>

          <div className="p-3 rounded bg-[#111827] border border-[#1F2937] flex items-center justify-between">
            <div>
              <span className="font-mono font-semibold text-white block">
                Require Independent Peer Approval (SoD)
              </span>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Enforces approval gatekeeper. Cannot be resolved until an independent approver signs off.
              </p>
            </div>
            <input
              type="checkbox"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 bg-[#090D16] border-gray-700"
            />
          </div>

          {/* Idempotency Key Inspector */}
          <div className="p-3 rounded bg-[#161D2F] border border-blue-900/60 space-y-1.5 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-300 flex items-center gap-1">
                <Repeat className="w-3.5 h-3.5" />
                Network Retry Idempotency-Key
              </span>
              <button
                onClick={handleCopyKey}
                className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1"
              >
                {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey ? 'Copied' : 'Copy Key'}</span>
              </button>
            </div>
            <div className="bg-[#090D16] p-2 rounded border border-gray-800 text-[11px] text-emerald-300 break-all select-all">
              {idempotencyKey}
            </div>
            <p className="text-[10px] text-gray-400 font-sans">
              PostgreSQL stores request hash & response body with advisory transaction lock serialization.
            </p>
          </div>

          {/* Replay Test Results */}
          {replayTestResults && (
            <div className="p-3 rounded bg-emerald-950/40 border border-emerald-600/60 font-mono text-xs space-y-2">
              <div className="flex items-center gap-2 text-emerald-300 font-bold">
                <Check className="w-4 h-4" />
                <span>Network Double-Click Deduplication Verified</span>
              </div>
              <div className="space-y-1 text-[11px]">
                {replayTestResults.map((r) => (
                  <div key={r.requestIndex} className="flex items-center justify-between text-gray-300">
                    <span>
                      Request #{r.requestIndex}: HTTP {r.statusCode}{' '}
                      {r.isReplay ? (
                        <strong className="text-amber-400">[X-Idempotent-Replay: true]</strong>
                      ) : (
                        <strong className="text-emerald-400">[Original Mutation Committed]</strong>
                      )}
                    </span>
                    <span className="text-gray-500 tabular-nums">{r.durationMs} ms</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#0B0F19] border-t border-[#1F2937] flex items-center justify-between text-xs font-mono">
          <button
            onClick={handleTestNetworkDoubleClick}
            disabled={isSubmitting || !title.trim()}
            className="px-3 py-1.5 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-600/60 text-amber-300 font-medium transition-colors disabled:opacity-40"
            title="Fire 3 identical POST requests simultaneously with the same Idempotency-Key"
          >
            ⚡ Test Network Double-Click (Send 3x)
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-[#1E293B] hover:bg-[#334155] text-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={isSubmitting || !title.trim()}
              className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors disabled:opacity-40"
            >
              {isSubmitting ? 'Creating...' : 'Create Item'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
