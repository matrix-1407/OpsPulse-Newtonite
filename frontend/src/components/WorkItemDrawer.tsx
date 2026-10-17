import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  ShieldCheck,
  Send,
  Lock,
  RotateCcw,
  Check,
  Radio,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  FileCheck2,
} from 'lucide-react';
import { api, ApiError } from '../api/client';
import {
  WorkItem,
  Persona,
  WorkItemStatus,
  Priority,
  AuditEvent,
  Comment,
  RFCError,
} from '../types';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { OCCConflictModal } from './OCCConflictModal';

interface WorkItemDrawerProps {
  item: WorkItem;
  activePersona: Persona;
  onClose: () => void;
  onItemUpdated: (item: WorkItem) => void;
  liveUpdatedId?: string | null;
}

export const WorkItemDrawer: React.FC<WorkItemDrawerProps> = ({
  item,
  activePersona,
  onClose,
  onItemUpdated,
  liveUpdatedId,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'audit' | 'outbox'>('details');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorBanner, setErrorBanner] = useState<RFCError | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Form states for OCC edit
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description || '');
  const [priority, setPriority] = useState<Priority>(item.priority);
  const [showDevOptions, setShowDevOptions] = useState(false);
  const [simulateStaleVersion, setSimulateStaleVersion] = useState(false);

  // Modals
  const [conflictModalData, setConflictModalData] = useState<{
    staleItem: {
      expectedVersion: number;
      attemptedChanges: { title?: string; description?: string; priority?: string };
    };
    serverItem: WorkItem;
  } | null>(null);

  // Audit Events & Comments
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  useEffect(() => {
    setTitle(item.title);
    setDescription(item.description || '');
    setPriority(item.priority);
    setErrorBanner(null);
    setSuccessBanner(null);
    if (activeTab === 'audit') {
      loadAudit();
    }
  }, [item.id, item.version, activeTab]);

  const loadAudit = async () => {
    setIsLoadingAudit(true);
    try {
      const data = await api.fetchAuditEvents(item.id);
      setAuditEvents(data);
    } catch (err: any) {
      console.error('Failed to load audit events:', err);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const handleUpdateOCC = async () => {
    setIsSubmitting(true);
    setErrorBanner(null);
    setSuccessBanner(null);

    const expectedVersion = simulateStaleVersion ? item.version - 1 : item.version;

    try {
      const updated = await api.updateWorkItem(
        item.id,
        {
          expected_version: expectedVersion,
          title,
          description,
          priority,
        },
        activePersona.id
      );
      onItemUpdated(updated);
      setSuccessBanner(`Updated to version v${updated.version} successfully.`);
    } catch (err: any) {
      const apiErr = err as ApiError;
      if (apiErr.code === 'STALE_VERSION_CONFLICT' && apiErr.current_state) {
        setConflictModalData({
          staleItem: {
            expectedVersion,
            attemptedChanges: { title, description, priority },
          },
          serverItem: apiErr.current_state,
        });
      } else {
        setErrorBanner(apiErr);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClaim = async () => {
    setIsSubmitting(true);
    setErrorBanner(null);
    setSuccessBanner(null);

    try {
      const { item: updated } = await api.claimWorkItem(
        item.id,
        item.version,
        activePersona.id
      );
      onItemUpdated(updated);
      setSuccessBanner(`Claimed successfully! Assigned to ${activePersona.name}.`);
    } catch (err: any) {
      setErrorBanner(err as ApiError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransition = async (targetStatus: WorkItemStatus) => {
    setIsSubmitting(true);
    setErrorBanner(null);
    setSuccessBanner(null);

    try {
      const { item: updated } = await api.transitionWorkItem(
        item.id,
        {
          expected_version: item.version,
          target_status: targetStatus,
          reason: `Transitioned by operator ${activePersona.name}`,
        },
        activePersona.id
      );
      onItemUpdated(updated);
      setSuccessBanner(`Status updated to ${targetStatus} (v${updated.version}).`);
    } catch (err: any) {
      setErrorBanner(err as ApiError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (decision: 'APPROVED' | 'REJECTED') => {
    setIsSubmitting(true);
    setErrorBanner(null);
    setSuccessBanner(null);

    try {
      const { item: updated } = await api.approveWorkItem(
        item.id,
        {
          expected_version: item.version,
          decision,
          comment: `Decision by ${activePersona.name}`,
        },
        activePersona.id
      );
      onItemUpdated(updated);
      setSuccessBanner(
        decision === 'APPROVED'
          ? `Request approved successfully (v${updated.version}).`
          : `Request marked rejected (v${updated.version}).`
      );
    } catch (err: any) {
      setErrorBanner(err as ApiError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      const added = await api.addComment(item.id, newComment, activePersona.id);
      setComments([added, ...comments]);
      setNewComment('');
    } catch (err: any) {
      setErrorBanner(err as ApiError);
    }
  };

  // Human-friendly next status label
  const getActionLabel = (status: WorkItemStatus): string => {
    switch (status) {
      case 'INVESTIGATING':
        return 'Move to Investigating';
      case 'PENDING_APPROVAL':
        return 'Submit for Peer Approval';
      case 'APPROVED':
        return 'Approve Request';
      case 'RESOLVED':
        return 'Mark Resolved';
      case 'CLOSED':
        return 'Close Request';
      case 'BLOCKED':
        return 'Flag as Blocked';
      default:
        return `Move to ${status}`;
    }
  };

  const getAvailableTransitions = (status: WorkItemStatus): WorkItemStatus[] => {
    switch (status) {
      case 'TRIAGE':
        return ['INVESTIGATING', 'BLOCKED', 'CLOSED'];
      case 'INVESTIGATING':
        return item.requires_approval
          ? ['PENDING_APPROVAL', 'BLOCKED']
          : ['RESOLVED', 'BLOCKED'];
      case 'PENDING_APPROVAL':
        return ['APPROVED', 'INVESTIGATING', 'BLOCKED'];
      case 'APPROVED':
        return ['RESOLVED', 'INVESTIGATING', 'BLOCKED'];
      case 'BLOCKED':
        return ['INVESTIGATING', 'TRIAGE'];
      case 'RESOLVED':
        return ['CLOSED', 'INVESTIGATING'];
      case 'CLOSED':
        return [];
      default:
        return [];
    }
  };

  const availableTransitions = getAvailableTransitions(item.status);
  const isAssignee = item.assignee_id === activePersona.id;
  const isCreator = item.created_by_id === activePersona.id;
  const sodViolation = isAssignee || isCreator;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-2xl bg-white dark:bg-[#0E1526] border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col font-sans animate-slide-left transition-colors duration-200">
      {/* Top Header */}
      <div className="p-5 bg-slate-50/90 dark:bg-[#111827]/90 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-sm text-slate-800 dark:text-slate-100">
            {item.id}
          </span>
          <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm">
            v{item.version}
          </span>
          {liveUpdatedId === item.id && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 animate-pulse">
              <Radio className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              LIVE UPDATE
            </span>
          )}
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <StatusBadge status={item.status} size="sm" />
          <PriorityBadge priority={item.priority} />
        </div>

        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Structured Domain Policy Alert Banner */}
      {errorBanner && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/60 text-xs text-rose-900 dark:text-rose-200 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold font-mono flex items-center gap-2">
                <span>POLICY REJECTION:</span>
                <span className="bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                  {errorBanner.code}
                </span>
              </div>
              <p className="mt-1 leading-relaxed text-slate-700 dark:text-slate-300">
                {errorBanner.message}
              </p>
              {errorBanner.code === 'APPROVAL_GATE_LOCKED' && (
                <p className="mt-1 font-semibold text-rose-800 dark:text-rose-300">
                  Compliance Rule: High-risk requests cannot transition to RESOLVED until an independent approver signs off. Current approval status: {errorBanner.approval_status}.
                </p>
              )}
              {errorBanner.code === 'SEPARATION_OF_DUTIES_VIOLATION' && (
                <p className="mt-1 font-semibold text-rose-800 dark:text-rose-300">
                  Compliance Rule: Separation of duties requires an independent peer review. Operators cannot approve tasks they created or are assigned to.
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setErrorBanner(null)}
            className="text-rose-400 hover:text-rose-700 dark:hover:text-rose-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium">{successBanner}</span>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Primary Action Ribbon */}
      <div className="p-4 bg-white dark:bg-[#0E1526] border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center gap-2">
        {/* Atomic Claim Action */}
        {!item.assignee_id && item.status === 'TRIAGE' ? (
          <button
            onClick={handleClaim}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <User className="w-3.5 h-3.5" />
            <span>Claim Request</span>
          </button>
        ) : null}

        {/* Workflow Transitions */}
        {availableTransitions.map((target) => (
          <button
            key={target}
            onClick={() => handleTransition(target)}
            disabled={isSubmitting}
            className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-700 transition-all disabled:opacity-50 cursor-pointer"
          >
            <span>{getActionLabel(target)}</span>
          </button>
        ))}

        {/* Intentional Gatekeeper Violation Test */}
        {item.requires_approval &&
          item.approval_status !== 'APPROVED' &&
          item.status !== 'RESOLVED' &&
          item.status !== 'CLOSED' && (
            <button
              onClick={() => handleTransition('RESOLVED')}
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-medium border border-rose-200 dark:border-rose-800 transition-colors flex items-center gap-1 cursor-pointer"
              title="Test compliance gatekeeper rejection (HTTP 422 APPROVAL_GATE_LOCKED)"
            >
              <Lock className="w-3 h-3 text-rose-500 dark:text-rose-400" />
              <span>Test Gatekeeper: Force Resolve</span>
            </button>
          )}

        {/* Peer Approval Action */}
        {item.status === 'PENDING_APPROVAL' && (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
            <button
              onClick={() => handleApprove('APPROVED')}
              disabled={isSubmitting}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                sodViolation
                  ? 'bg-violet-50 dark:bg-violet-950/50 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/60'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
              title={
                sodViolation
                  ? 'Separation of Duties violation: you cannot approve your own assigned item'
                  : 'Approve request'
              }
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{sodViolation ? 'Test SoD Violation (Approve)' : 'Approve Request'}</span>
            </button>

            <button
              onClick={() => handleApprove('REJECTED')}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium cursor-pointer"
            >
              Reject
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="px-5 bg-slate-50/60 dark:bg-[#111827]/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-6 text-xs">
        <button
          onClick={() => setActiveTab('details')}
          className={`py-3 border-b-2 font-medium transition-colors cursor-pointer ${
            activeTab === 'details'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Overview & Edit
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`py-3 border-b-2 font-medium transition-colors cursor-pointer ${
            activeTab === 'audit'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Activity & Audit History
        </button>
        <button
          onClick={() => setActiveTab('outbox')}
          className={`py-3 border-b-2 font-medium transition-colors cursor-pointer ${
            activeTab === 'outbox'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Async Outbox & Notes
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Tab 1: Overview & Edit */}
        {activeTab === 'details' && (
          <div className="space-y-6">
            {/* Metadata Summary Card */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-semibold block">
                  Team
                </span>
                <span className="text-slate-900 dark:text-slate-100 font-semibold mt-0.5 block">
                  {item.owning_team_id.replace('team_', '').toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-semibold block">
                  Assignee
                </span>
                <span className="text-slate-900 dark:text-slate-100 font-semibold mt-0.5 block truncate">
                  {item.assignee_name || item.assignee_id || 'Unassigned'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-semibold block">
                  Approval Status
                </span>
                <span className="font-semibold mt-0.5 block text-slate-700 dark:text-slate-300">
                  {item.approval_status}
                </span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-semibold block">
                  OCC Version
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-bold mt-0.5 block">
                  v{item.version}
                </span>
              </div>
            </div>

            {/* Edit Form */}
            <div className="p-5 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-subtle space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono">
                  Operational Parameters
                </span>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  expected_version: <strong className="text-blue-600 dark:text-blue-400">v{item.version}</strong>
                </span>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 font-sans"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 font-sans"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 font-mono"
                >
                  <option value="CRITICAL">P0 CRITICAL</option>
                  <option value="HIGH">P1 HIGH</option>
                  <option value="MEDIUM">P2 MEDIUM</option>
                  <option value="LOW">P3 LOW</option>
                </select>
              </div>

              {/* Collapsible Developer Concurrency Test Options */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDevOptions(!showDevOptions)}
                  className="flex items-center justify-between w-full text-xs font-mono text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 py-1 cursor-pointer"
                >
                  <span>Developer Concurrency Test Options</span>
                  {showDevOptions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showDevOptions && (
                  <div className="mt-2 p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-bold text-amber-800 dark:text-amber-300 block">
                        Simulate Stale Edit (expected_version: v{item.version - 1})
                      </span>
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 font-sans mt-0.5">
                        Forces a version mismatch to trigger the Side-by-Side OCC Conflict Resolver.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={simulateStaleVersion}
                      onChange={(e) => setSimulateStaleVersion(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-0 border-amber-300 dark:border-amber-700"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={handleUpdateOCC}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 transition-all shadow-sm cursor-pointer"
                >
                  {isSubmitting ? 'Submitting...' : 'Save Changes (OCC Verified)'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Activity & Audit History */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 uppercase">
                Append-Only Audit Ledger ({auditEvents.length} events)
              </span>
              <button
                onClick={loadAudit}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>

            {isLoadingAudit ? (
              <div className="py-12 text-center font-mono text-xs text-slate-400">
                Loading audit ledger...
              </div>
            ) : auditEvents.length === 0 ? (
              <div className="py-12 text-center font-mono text-xs text-slate-400">
                No audit events recorded for this work item yet.
              </div>
            ) : (
              <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-3 space-y-6">
                {auditEvents.map((event) => (
                  <div key={event.id} className="relative pl-6 text-xs">
                    <div className="absolute -left-[9px] top-0.5 w-4 h-4 rounded-full bg-white dark:bg-slate-900 border-2 border-blue-600 shadow-sm" />
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                      <div>
                        <strong className="text-slate-900 dark:text-slate-100 font-sans">{event.actor_name || event.actor_id}</strong>{' '}
                        <span>performed</span>{' '}
                        <span className="px-2 py-0.5 rounded font-mono font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {event.action}
                        </span>
                      </div>
                      <span>
                        {new Date(event.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="mt-1 text-slate-700 dark:text-slate-300 text-xs">
                      Version transition:{' '}
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        v{event.from_version ?? '-'}
                      </span>{' '}
                      &rarr;{' '}
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        v{event.to_version ?? '-'}
                      </span>
                      {event.from_status && event.to_status && (
                        <span className="ml-2 font-mono text-slate-500 dark:text-slate-400">
                          ({event.from_status} &rarr; {event.to_status})
                        </span>
                      )}
                    </div>

                    {event.payload && Object.keys(event.payload).length > 0 && (
                      <div className="mt-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        {Object.entries(event.payload).map(([k, v]) => (
                          <div key={k} className="flex gap-2">
                            <span className="text-slate-400 dark:text-slate-500 font-semibold">{k}:</span>
                            <span className="text-slate-800 dark:text-slate-200 truncate">{JSON.stringify(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Async Outbox & Comments */}
        {activeTab === 'outbox' && (
          <div className="space-y-6 text-xs">
            {/* Outbox Status Banner */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 space-y-3 font-sans">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  Transactional Outbox Events
                </span>
                <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                  ACID ENQUEUED
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-xs">
                Mutations on this item are written to <code className="font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1 py-0.5 rounded">outbox_jobs</code> within the exact same database transaction, guaranteeing reliable downstream event publishing without Redis lock contention.
              </p>
            </div>

            {/* Notes Section */}
            <div className="space-y-3">
              <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 uppercase block">
                Collaborative Operational Notes
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Leave operational handoff note..."
                  className="flex-1 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 font-sans"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                />
                <button
                  onClick={handleAddComment}
                  className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1 shadow-sm cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                  <span>Post</span>
                </button>
              </div>

              <div className="space-y-2">
                {comments.map((c) => (
                  <div key={c.id} className="p-3 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-subtle">
                    <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 font-mono text-[10px] mb-1">
                      <strong className="text-slate-900 dark:text-slate-100 font-sans">{c.author_name || c.author_id}</strong>
                      <span>{new Date(c.created_at).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 font-sans">{c.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* OCC Conflict Resolver Modal */}
      {conflictModalData && (
        <OCCConflictModal
          staleItem={conflictModalData.staleItem}
          serverItem={conflictModalData.serverItem}
          onDiscard={() => {
            onItemUpdated(conflictModalData.serverItem);
            setConflictModalData(null);
          }}
          onForceReapply={async (serverVersion) => {
            setConflictModalData(null);
            setIsSubmitting(true);
            try {
              const updated = await api.updateWorkItem(
                item.id,
                {
                  expected_version: serverVersion,
                  title,
                  description,
                  priority,
                },
                activePersona.id
              );
              onItemUpdated(updated);
              setSuccessBanner(`Re-applied changes cleanly on top of v${updated.version}.`);
            } catch (err: any) {
              setErrorBanner(err as ApiError);
            } finally {
              setIsSubmitting(false);
            }
          }}
          onClose={() => setConflictModalData(null)}
        />
      )}
    </div>
  );
};
