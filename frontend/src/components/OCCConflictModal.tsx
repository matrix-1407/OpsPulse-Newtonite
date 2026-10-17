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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in font-sans">
      <div className="w-full max-w-3xl rounded-2xl bg-white border border-slate-200 shadow-popover overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-rose-50/60 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 flex-shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                <span>HTTP 409 Conflict: STALE_VERSION_CONFLICT</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-100 text-rose-700 border border-rose-200">
                  OCC Guard Active
                </span>
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Optimistic Concurrency Control (OCC) rejected this mutation. Another operator committed changes first.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Side-by-Side Comparison */}
        <div className="p-6 space-y-4">
          <div className="text-xs text-slate-600 leading-relaxed">
            You attempted to mutate version{' '}
            <span className="font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
              v{staleItem.expectedVersion}
            </span>
            , but the database version in PostgreSQL is already{' '}
            <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              v{serverItem.version}
            </span>
            . Compare your attempted changes against the latest server state below:
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Attempted Local Changes (Stale) */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-amber-200/60">
                  <span className="text-xs font-semibold text-amber-900 uppercase tracking-wider">
                    Your Attempted Mutation
                  </span>
                  <span className="text-[10px] font-mono bg-amber-100 px-2 py-0.5 rounded text-amber-800 border border-amber-300 font-medium">
                    Stale v{staleItem.expectedVersion}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-mono block">
                      Title
                    </span>
                    <p className="text-slate-900 font-medium mt-0.5">
                      {staleItem.attemptedChanges.title || '(No change)'}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-mono block">
                      Description
                    </span>
                    <p className="text-slate-700 text-xs mt-0.5 line-clamp-3">
                      {staleItem.attemptedChanges.description || '(No change)'}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-mono block">
                      Priority
                    </span>
                    <span className="text-amber-800 font-mono text-xs font-semibold mt-0.5 inline-block">
                      {staleItem.attemptedChanges.priority || '(No change)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Current Server State */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-emerald-200/60">
                  <span className="text-xs font-semibold text-emerald-900 uppercase tracking-wider">
                    Latest Server State
                  </span>
                  <span className="text-[10px] font-mono bg-emerald-100 px-2 py-0.5 rounded text-emerald-800 border border-emerald-300 font-medium">
                    Active v{serverItem.version}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-mono block">
                      Current Title
                    </span>
                    <p className="text-slate-900 font-medium mt-0.5">
                      {serverItem.title}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-mono block">
                      Current Description
                    </span>
                    <p className="text-slate-700 text-xs mt-0.5 line-clamp-3">
                      {serverItem.description || '(Empty)'}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-mono block">
                      Current Status & Priority
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-slate-800 font-medium text-xs">
                        {serverItem.status}
                      </span>
                      <span className="text-emerald-700 font-mono text-xs font-semibold">
                        {serverItem.priority}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
            <RefreshCw className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-900">PostgreSQL Atomicity:</span>{' '}
              <span>
                Mutation executed <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-800 text-[11px]">WHERE id = '{serverItem.id}' AND version = {staleItem.expectedVersion}</code>. Because version incremented to {serverItem.version}, rowcount was 0 and no phantom overwrite occurred.
              </span>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 text-xs font-medium">
          <button
            onClick={onDiscard}
            className="px-4 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors shadow-sm"
          >
            Discard My Changes & Reload v{serverItem.version}
          </button>
          <button
            onClick={() => onForceReapply(serverItem.version)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors shadow-sm flex items-center gap-1.5"
          >
            <span>Re-apply My Changes on Top of v{serverItem.version}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
