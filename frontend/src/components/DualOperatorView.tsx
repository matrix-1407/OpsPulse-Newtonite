import React, { useState } from 'react';
import { Columns, ArrowRight, Zap, RefreshCw, AlertTriangle, ShieldCheck, User } from 'lucide-react';
import { Persona, WorkItem } from '../types';
import { api, ApiError } from '../api/client';
import { StatusBadge } from './StatusBadge';

interface DualOperatorViewProps {
  personas: Persona[];
  workItems: WorkItem[];
  onItemUpdated: (item: WorkItem) => void;
  onClose: () => void;
}

export const DualOperatorView: React.FC<DualOperatorViewProps> = ({
  personas,
  workItems,
  onItemUpdated,
  onClose,
}) => {
  const [opA, setOpA] = useState<Persona>(personas[0] || { id: 'usr_aarav', name: 'Aarav Mehta', email: '', roles: {} });
  const [opB, setOpB] = useState<Persona>(personas[1] || { id: 'usr_priya', name: 'Priya Nair', email: '', roles: {} });

  const [selectedItemId, setSelectedItemId] = useState<string>(workItems[0]?.id || '');
  const [currentItem, setCurrentItem] = useState<WorkItem | null>(
    workItems.find((w) => w.id === selectedItemId) || workItems[0] || null
  );

  const [opAEdit, setOpAEdit] = useState('');
  const [opBEdit, setOpBEdit] = useState('');

  const [logMessages, setLogMessages] = useState<Array<{ sender: string; text: string; type: 'info' | 'success' | 'conflict' | 'error' }>>([]);

  const addLog = (sender: string, text: string, type: 'info' | 'success' | 'conflict' | 'error' = 'info') => {
    setLogMessages((prev) => [{ sender, text, type }, ...prev.slice(0, 15)]);
  };

  const reloadItem = async () => {
    if (!selectedItemId) return;
    try {
      const fresh = await api.fetchWorkItem(selectedItemId, opA.id);
      setCurrentItem(fresh);
      onItemUpdated(fresh);
      addLog('System', `Fetched latest state: v${fresh.version} (${fresh.status})`, 'info');
    } catch (e: any) {
      addLog('System', `Failed to fetch: ${e.message}`, 'error');
    }
  };

  const handleOpASubmit = async () => {
    if (!currentItem) return;
    const expected = currentItem.version;
    addLog(opA.name, `Submitting edit with expected_version: v${expected}...`, 'info');
    try {
      const updated = await api.updateWorkItem(
        currentItem.id,
        {
          expected_version: expected,
          title: opAEdit || `${currentItem.title} (Edited by ${opA.name})`,
        },
        opA.id
      );
      setCurrentItem(updated);
      onItemUpdated(updated);
      addLog(opA.name, `Update SUCCESS! Bumped to v${updated.version}`, 'success');
    } catch (err: any) {
      const apiErr = err as ApiError;
      addLog(opA.name, `REJECTED: HTTP ${apiErr.status_code} ${apiErr.code} - ${apiErr.message}`, 'conflict');
    }
  };

  const handleOpBSubmit = async () => {
    if (!currentItem) return;
    const expected = currentItem.version;
    addLog(opB.name, `Submitting edit with expected_version: v${expected}...`, 'info');
    try {
      const updated = await api.updateWorkItem(
        currentItem.id,
        {
          expected_version: expected,
          title: opBEdit || `${currentItem.title} (Edited by ${opB.name})`,
        },
        opB.id
      );
      setCurrentItem(updated);
      onItemUpdated(updated);
      addLog(opB.name, `Update SUCCESS! Bumped to v${updated.version}`, 'success');
    } catch (err: any) {
      const apiErr = err as ApiError;
      addLog(opB.name, `REJECTED: HTTP ${apiErr.status_code} ${apiErr.code} - ${apiErr.message}`, 'conflict');
    }
  };

  const handleSimultaneousRace = async () => {
    if (!currentItem) return;
    const commonExpectedVersion = currentItem.version;
    addLog('Simulator', `Fired 2 concurrent edits both holding expected_version: v${commonExpectedVersion}`, 'info');

    const [resA, resB] = await Promise.allSettled([
      api.updateWorkItem(
        currentItem.id,
        {
          expected_version: commonExpectedVersion,
          title: `${currentItem.title} [Op A Wins]`,
        },
        opA.id
      ),
      api.updateWorkItem(
        currentItem.id,
        {
          expected_version: commonExpectedVersion,
          title: `${currentItem.title} [Op B Conflict]`,
        },
        opB.id
      ),
    ]);

    if (resA.status === 'fulfilled') {
      addLog(opA.name, `Won race! Version bumped to v${resA.value.version}`, 'success');
      setCurrentItem(resA.value);
      onItemUpdated(resA.value);
    } else {
      const err = resA.reason as ApiError;
      addLog(opA.name, `HTTP ${err.status_code} ${err.code}`, 'conflict');
    }

    if (resB.status === 'fulfilled') {
      addLog(opB.name, `Won race! Version bumped to v${resB.value.version}`, 'success');
      setCurrentItem(resB.value);
      onItemUpdated(resB.value);
    } else {
      const err = resB.reason as ApiError;
      addLog(opB.name, `HTTP ${err.status_code} ${err.code}: Stale version conflict rejected!`, 'conflict');
    }
  };

  return (
    <div className="bg-[#0B0F19] border-b border-[#1F2937] p-4 text-xs font-mono space-y-4">
      {/* Simulator Control Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-[#1F2937]">
        <div className="flex items-center gap-2">
          <Columns className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-white text-sm">
            Dual-Operator Concurrency Simulator
          </span>
          <span className="text-[10px] bg-amber-950 text-amber-300 px-2 py-0.5 rounded border border-amber-800">
            OCC & Race Laboratory
          </span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedItemId}
            onChange={(e) => {
              setSelectedItemId(e.target.value);
              const found = workItems.find((w) => w.id === e.target.value);
              if (found) setCurrentItem(found);
            }}
            className="bg-[#111827] border border-[#1F2937] rounded px-2.5 py-1 text-white font-mono text-xs"
          >
            {workItems.slice(0, 15).map((w) => (
              <option key={w.id} value={w.id}>
                {w.id} (v{w.version}) - {w.title.slice(0, 30)}
              </option>
            ))}
          </select>

          <button
            onClick={reloadItem}
            className="p-1 rounded bg-[#111827] hover:bg-[#1E293B] border border-[#1F2937] text-gray-300"
            title="Reload item"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleSimultaneousRace}
            className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-1 transition-colors"
          >
            <Zap className="w-3 h-3" />
            <span>Fire 2-Way Simultaneous Race</span>
          </button>

          <button
            onClick={onClose}
            className="px-2.5 py-1 rounded bg-[#1E293B] hover:bg-[#334155] text-gray-300"
          >
            Close Simulator
          </button>
        </div>
      </div>

      {/* Target Item Bar */}
      {currentItem && (
        <div className="p-2.5 rounded bg-[#111827] border border-[#1F2937] flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Target Item:</span>
            <strong className="text-white">{currentItem.id}</strong>
            <span className="text-blue-400 font-bold bg-[#1E293B] px-1.5 py-0.2 rounded border border-blue-900">
              v{currentItem.version}
            </span>
            <StatusBadge status={currentItem.status} size="sm" />
            <span className="text-gray-300 truncate max-w-md">"{currentItem.title}"</span>
          </div>
          <div className="text-gray-400">
            Assignee: <strong className="text-white">{currentItem.assignee_id || 'None'}</strong>
          </div>
        </div>
      )}

      {/* Side-by-Side Operators Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Operator A Panel */}
        <div className="p-4 rounded-lg bg-[#111827] border border-blue-600/40 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-blue-400" />
              <span className="font-bold text-white">Operator 1 (Left Screen)</span>
            </div>
            <select
              value={opA.id}
              onChange={(e) => {
                const p = personas.find((x) => x.id === e.target.value);
                if (p) setOpA(p);
              }}
              className="bg-[#090D16] border border-gray-700 rounded px-2 py-0.5 text-xs text-blue-300"
            >
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.id})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <input
              type="text"
              value={opAEdit}
              onChange={(e) => setOpAEdit(e.target.value)}
              placeholder={`Edit title as ${opA.name}...`}
              className="w-full bg-[#090D16] border border-gray-700 rounded px-3 py-1.5 text-xs text-white"
            />
            <button
              onClick={handleOpASubmit}
              className="w-full py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors shadow-sm"
            >
              Send Edit as {opA.name} (v{currentItem?.version})
            </button>
          </div>
        </div>

        {/* Operator B Panel */}
        <div className="p-4 rounded-lg bg-[#111827] border border-purple-600/40 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-purple-400" />
              <span className="font-bold text-white">Operator 2 (Right Screen)</span>
            </div>
            <select
              value={opB.id}
              onChange={(e) => {
                const p = personas.find((x) => x.id === e.target.value);
                if (p) setOpB(p);
              }}
              className="bg-[#090D16] border border-gray-700 rounded px-2 py-0.5 text-xs text-purple-300"
            >
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.id})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <input
              type="text"
              value={opBEdit}
              onChange={(e) => setOpBEdit(e.target.value)}
              placeholder={`Edit title as ${opB.name}...`}
              className="w-full bg-[#090D16] border border-gray-700 rounded px-3 py-1.5 text-xs text-white"
            />
            <button
              onClick={handleOpBSubmit}
              className="w-full py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold transition-colors shadow-sm"
            >
              Send Edit as {opB.name} (v{currentItem?.version})
            </button>
          </div>
        </div>
      </div>

      {/* Simulator Real-Time Event Log */}
      <div className="p-3 rounded bg-[#090D16] border border-[#1F2937] max-h-40 overflow-y-auto space-y-1 text-[11px]">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
          Simulator Event Stream:
        </div>
        {logMessages.length === 0 ? (
          <div className="text-gray-500 italic">No actions executed yet. Click a button above.</div>
        ) : (
          logMessages.map((msg, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-gray-500">[{msg.sender}]:</span>
              <span
                className={
                  msg.type === 'success'
                    ? 'text-emerald-400 font-semibold'
                    : msg.type === 'conflict'
                    ? 'text-red-400 font-semibold'
                    : msg.type === 'error'
                    ? 'text-red-300'
                    : 'text-gray-300'
                }
              >
                {msg.text}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
