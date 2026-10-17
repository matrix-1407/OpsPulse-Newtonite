import React from 'react';
import { AlertTriangle, ArrowRight, RefreshCw, X, ShieldAlert } from 'lucide-react';
import { WorkItem } from '../types';

interface OCCConflictModalProps {
  staleItem: {
    expectedVersion: number;
    attemptedChanges: {
      title?: string;
      description?: string;
      priority?: string;
    };
  };
  serverItem: WorkItem;
  onDiscard: () => void;
  onForceReapply: (serverVersion: number) => void;
  onClose: () => void;
}

export const OCCConflictModal: React.FC<OCCConflictModalProps> = ({
  staleItem,
  serverItem,
  onDiscard,
  onForceReapply,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="w-full max-w-3xl rounded-lg bg-[#0F172A] border border-red-500/60 shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-red-950/60 border-b border-red-500/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-red-300">
            <ShieldAlert className="w-5 h-5 text-red-400 animate-pulse" />
            <div>
              <h3 className="font-mono font-bold text-sm text-white">
                HTTP 409 Conflict: STALE_VERSION_CONFLICT
              </h3>
              <p className="text-xs text-red-300 font-sans">
                Optimistic Concurrency Control (OCC) rejected this mutation. The item was modified by another operator.
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

        {/* Side-by-Side Comparison */}
        <div className="p-6 space-y-4">
          <div className="text-xs text-gray-300">
            You attempted to mutate version{' '}
            <span className="font-mono font-bold text-amber-400">
              v{staleItem.expectedVersion}
            </span>
            , but the database version in PostgreSQL is already{' '}
            <span className="font-mono font-bold text-emerald-400">
              v{serverItem.version}
            </span>
            . Compare your changes against the latest server state below:
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Attempted Local Changes (Stale) */}
            <div className="rounded border border-amber-600/50 bg-[#161D2F] p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-800">
                  <span className="text-xs font-mono font-bold text-amber-400 uppercase">
                    Your Attempted Mutation
                  </span>
                  <span className="text-[10px] font-mono bg-amber-950 px-2 py-0.5 rounded text-amber-300 border border-amber-700/50">
                    Stale v{staleItem.expectedVersion}
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-mono block">
                      Title
                    </span>
                    <p className="text-white font-medium mt-0.5">
                      {staleItem.attemptedChanges.title || '(No change)'}
                    </p>
                  </div>

                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-mono block">
                      Description
                    </span>
                    <p className="text-gray-300 text-xs mt-0.5 line-clamp-3">
                      {staleItem.attemptedChanges.description || '(No change)'}
                    </p>
                  </div>

                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-mono block">
                      Priority
                    </span>
                    <span className="text-amber-300 font-mono text-xs mt-0.5 inline-block">
                      {staleItem.attemptedChanges.priority || '(No change)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Current Server State */}
            <div className="rounded border border-emerald-600/50 bg-[#161D2F] p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-800">
                  <span className="text-xs font-mono font-bold text-emerald-400 uppercase">
                    Latest Server State
                  </span>
                  <span className="text-[10px] font-mono bg-emerald-950 px-2 py-0.5 rounded text-emerald-300 border border-emerald-700/50">
                    Active v{serverItem.version}
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-mono block">
                      Current Title
                    </span>
                    <p className="text-white font-medium mt-0.5">
                      {serverItem.title}
                    </p>
                  </div>

                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-mono block">
                      Current Description
                    </span>
                    <p className="text-gray-300 text-xs mt-0.5 line-clamp-3">
                      {serverItem.description || '(Empty)'}
                    </p>
                  </div>

                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-mono block">
                      Current Status & Priority
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-gray-300 font-mono text-xs">
                        {serverItem.status}
                      </span>
                      <span className="text-emerald-300 font-mono text-xs">
                        {serverItem.priority}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded bg-[#111827] border border-[#1F2937] text-[11px] font-mono text-gray-400 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <span>
              <strong>OCC Guarantee:</strong> PostgreSQL checked <code className="text-blue-300">WHERE id = ... AND version = {staleItem.expectedVersion}</code>. Because version bumped to {serverItem.version}, rowcount was 0 and no phantom overwrite occurred.
            </span>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="px-6 py-3.5 bg-[#0B0F19] border-t border-[#1F2937] flex items-center justify-end gap-3 font-mono text-xs">
          <button
            onClick={onDiscard}
            className="px-3.5 py-1.5 rounded bg-[#1E293B] hover:bg-[#334155] text-gray-200 transition-colors"
          >
            Discard My Changes & Reload v{serverItem.version}
          </button>
          <button
            onClick={() => onForceReapply(serverItem.version)}
            className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors shadow-sm flex items-center gap-1.5"
          >
            <span>Re-apply My Changes on Top of v{serverItem.version}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
