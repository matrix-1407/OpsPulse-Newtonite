import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  Zap,
  Lock,
  History,
  FileText,
  AlertTriangle,
  RotateCcw,
  Check,
  Radio,
  Server,
  ArrowRight,
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
import { RaceSimulationModal } from './RaceSimulationModal';
import { OCCConflictModal } from './OCCConflictModal';

interface WorkItemDrawerProps {
  item: WorkItem;
  activePersona: Persona;
  personas: Persona[];
  onClose: () => void;
  onItemUpdated: (item: WorkItem) => void;
  liveUpdatedId?: string | null;
}

export const WorkItemDrawer: React.FC<WorkItemDrawerProps> = ({
  item,
  activePersona,
  personas,
  onClose,
  onItemUpdated,
  liveUpdatedId,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'audit' | 'comments' | 'outbox'>('details');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorBanner, setErrorBanner] = useState<RFCError | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Form states for OCC edit
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description || '');
  const [priority, setPriority] = useState<Priority>(item.priority);
  const [simulateStaleVersion, setSimulateStaleVersion] = useState(false);

  // Modals
  const [showRaceModal, setShowRaceModal] = useState(false);
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

  // Reset form when item changes
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
      setSuccessBanner(`Claimed item! Assigned to ${activePersona.name} (v${updated.version}).`);
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
      setSuccessBanner(`Workflow moved to ${targetStatus} (v${updated.version}).`);
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
          ? `Item approved! Approval gate cleared (v${updated.version}).`
          : `Item rejected (v${updated.version}).`
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

  // State Machine Available Transitions based on ALLOWED_TRANSITIONS
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

  // Separation of duties check
  const isAssignee = item.assignee_id === activePersona.id;
  const isCreator = item.created_by_id === activePersona.id;
  const sodViolation = isAssignee || isCreator;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-2xl bg-[#0F172A] border-l border-[#1F2937] shadow-2xl flex flex-col font-sans animate-slide-left">
      {/* Top Header */}
      <div className="p-4 bg-[#111827] border-b border-[#1F2937] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm text-white">
              {item.id}
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#1E293B] text-blue-300 border border-blue-900/60">
              v{item.version}
            </span>
            {liveUpdatedId === item.id && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-700/60 animate-pulse">
                <Radio className="w-3 h-3 text-emerald-400" />
                LIVE UPDATE
              </span>
            )}
          </div>
          <span className="text-gray-500">|</span>
          <StatusBadge status={item.status} size="sm" />
          <PriorityBadge priority={item.priority} />
        </div>

        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors p-1"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Structured RFC Error Banner (Intentional Guardrail Demonstration) */}
      {errorBanner && (
        <div className="p-3 bg-red-950/70 border-b border-red-500/50 text-xs font-mono flex items-start justify-between gap-2 text-red-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white flex items-center gap-2">
                <span>HTTP {errorBanner.status_code}:</span>
                <span className="bg-red-900/80 px-1.5 py-0.2 rounded text-red-300">
                  {errorBanner.code}
                </span>
              </div>
              <p className="mt-1 font-sans text-red-200 leading-relaxed">
                {errorBanner.message}
              </p>
              {errorBanner.code === 'APPROVAL_GATE_LOCKED' && (
                <div className="mt-1 text-[11px] text-red-300 font-sans">
                  🛡️ <strong>Compliance Guardrail:</strong> Work item requires peer approval before resolving. Approval status is currently <code className="bg-red-900 px-1 rounded">{errorBanner.approval_status}</code>.
                </div>
              )}
              {errorBanner.code === 'SEPARATION_OF_DUTIES_VIOLATION' && (
                <div className="mt-1 text-[11px] text-red-300 font-sans">
                  🛡️ <strong>Separation of Duties:</strong> An operator cannot approve work items they themselves created or claimed.
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setErrorBanner(null)}
            className="text-red-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Success Banner */}
      {successBanner && (
        <div className="p-3 bg-emerald-950/70 border-b border-emerald-500/50 text-xs font-mono flex items-center justify-between text-emerald-200">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{successBanner}</span>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Action Bar (Atomic Claim + 5-Way Race + Workflow State Machine) */}
      <div className="p-3.5 bg-[#090D16] border-b border-[#1F2937] flex flex-wrap items-center gap-2">
        {/* Atomic Claim Action (if unassigned or TRIAGE) */}
        {!item.assignee_id && item.status === 'TRIAGE' ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleClaim}
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-medium disabled:opacity-50 transition-colors shadow-sm flex items-center gap-1.5"
            >
              <User className="w-3.5 h-3.5" />
              <span>Claim Work Item (SELECT FOR UPDATE)</span>
            </button>

            {/* Micro-button for 5-Way Claim Race */}
            <button
              onClick={() => setShowRaceModal(true)}
              className="px-2 py-1.5 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-600/60 text-amber-300 text-xs font-mono flex items-center gap-1 transition-colors"
              title="Test concurrency: fire 5 simultaneous claim requests from 5 operators"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>⚡ Simulate 5-Way Race</span>
            </button>
          </div>
        ) : null}

        {/* Workflow State Machine Transitions */}
        {availableTransitions.map((target) => (
          <button
            key={target}
            onClick={() => handleTransition(target)}
            disabled={isSubmitting}
            className="px-2.5 py-1.5 rounded bg-[#1E293B] hover:bg-[#334155] text-gray-200 text-xs font-mono border border-gray-700/60 transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <span>Move to</span>
            <strong className="text-white">{target}</strong>
          </button>
        ))}

        {/* Intentional Gatekeeper Test Button (e.g. Try to Resolve while Pending Approval) */}
        {item.requires_approval &&
          item.approval_status !== 'APPROVED' &&
          item.status !== 'RESOLVED' &&
          item.status !== 'CLOSED' && (
            <button
              onClick={() => handleTransition('RESOLVED')}
              disabled={isSubmitting}
              className="px-2.5 py-1.5 rounded bg-red-950/40 hover:bg-red-900/60 text-red-300 text-xs font-mono border border-red-800/60 transition-colors flex items-center gap-1"
              title="Click to intentionally test compliance gatekeeper rejection (HTTP 422 APPROVAL_GATE_LOCKED)"
            >
              <Lock className="w-3 h-3 text-red-400" />
              <span>Test Gatekeeper: Force Resolve</span>
            </button>
          )}

        {/* Approval Actions (When PENDING_APPROVAL) */}
        {item.status === 'PENDING_APPROVAL' && (
          <div className="flex items-center gap-1.5 pl-2 border-l border-gray-700">
            <button
              onClick={() => handleApprove('APPROVED')}
              disabled={isSubmitting}
              className={`px-3 py-1.5 rounded text-xs font-mono font-medium flex items-center gap-1 transition-colors ${
                sodViolation
                  ? 'bg-purple-950/40 border border-purple-800 text-purple-300 hover:bg-purple-900/40'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
              title={
                sodViolation
                  ? 'Separation of duties: clicking this will demonstrate backend rejection (HTTP 403 SEPARATION_OF_DUTIES_VIOLATION)'
                  : 'Approve item'
              }
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                {sodViolation ? 'Test SoD Violation (Approve)' : 'Approve Item'}
              </span>
            </button>

            <button
              onClick={() => handleApprove('REJECTED')}
              disabled={isSubmitting}
              className="px-2.5 py-1.5 rounded bg-red-950/60 hover:bg-red-900/60 border border-red-700 text-red-300 text-xs font-mono"
            >
              Reject
            </button>
          </div>
        )}
      </div>

      {/* Tabs Bar */}
      <div className="px-4 bg-[#0B0F19] border-b border-[#1F2937] flex items-center gap-4 text-xs font-mono">
        <button
          onClick={() => setActiveTab('details')}
          className={`py-2.5 border-b-2 font-medium transition-colors ${
            activeTab === 'details'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          Details & OCC Editor
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`py-2.5 border-b-2 font-medium transition-colors ${
            activeTab === 'audit'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          Immutable Audit Trail
        </button>
        <button
          onClick={() => setActiveTab('outbox')}
          className={`py-2.5 border-b-2 font-medium transition-colors ${
            activeTab === 'outbox'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          Transactional Outbox
        </button>
        <button
          onClick={() => setActiveTab('comments')}
          className={`py-2.5 border-b-2 font-medium transition-colors ${
            activeTab === 'comments'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          Comments
        </button>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'details' && (
          <div className="space-y-5">
            {/* Metadata Summary Card */}
            <div className="p-3.5 rounded bg-[#111827] border border-[#1F2937] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div>
                <span className="text-gray-500 text-[10px] uppercase block">
                  Owning Team
                </span>
                <span className="text-white font-semibold mt-0.5 block">
                  {item.owning_team_id.replace('team_', '').toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-gray-500 text-[10px] uppercase block">
                  Assignee
                </span>
                <span className="text-white font-semibold mt-0.5 block truncate">
                  {item.assignee_name || item.assignee_id || 'None'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 text-[10px] uppercase block">
                  Approval Status
                </span>
                <span
                  className={`font-semibold mt-0.5 block ${
                    item.approval_status === 'APPROVED'
                      ? 'text-emerald-400'
                      : item.approval_status === 'PENDING'
                      ? 'text-purple-400'
                      : 'text-gray-400'
                  }`}
                >
                  {item.approval_status}
                </span>
              </div>
              <div>
                <span className="text-gray-500 text-[10px] uppercase block">
                  OCC Version
                </span>
                <span className="text-blue-400 font-bold mt-0.5 block">
                  v{item.version}
                </span>
              </div>
            </div>

            {/* OCC Editor Form */}
            <div className="p-4 rounded-lg bg-[#111827] border border-[#1F2937] space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-800">
                <span className="text-xs font-mono font-semibold text-gray-200 uppercase tracking-wider">
                  Edit Work Item (Optimistic Concurrency Control)
                </span>
                <span className="text-[11px] font-mono text-gray-400">
                  Target expected_version: <strong className="text-blue-400">v{item.version}</strong>
                </span>
              </div>

              <div>
                <label className="text-xs font-mono text-gray-300 block mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#090D16] border border-[#1F2937] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-sans"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-gray-300 block mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#090D16] border border-[#1F2937] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-sans"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-gray-300 block mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="w-full bg-[#090D16] border border-[#1F2937] rounded px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="CRITICAL">P0 CRITICAL</option>
                  <option value="HIGH">P1 HIGH</option>
                  <option value="MEDIUM">P2 MEDIUM</option>
                  <option value="LOW">P3 LOW</option>
                </select>
              </div>

              {/* Stale Version Simulation Checkbox */}
              <div className="p-3 rounded bg-[#161D2F] border border-amber-600/40 flex items-center justify-between text-xs">
                <div>
                  <label
                    htmlFor="stale-toggle"
                    className="font-mono font-semibold text-amber-300 block cursor-pointer"
                  >
                    Simulate Stale Version Conflict (OCC Test)
                  </label>
                  <p className="text-[11px] text-gray-400 font-sans mt-0.5">
                    Sends <code className="font-mono text-amber-400">expected_version: v{item.version - 1}</code> to prove HTTP 409 rejection and launch the Conflict Resolver modal.
                  </p>
                </div>
                <input
                  id="stale-toggle"
                  type="checkbox"
                  checked={simulateStaleVersion}
                  onChange={(e) => setSimulateStaleVersion(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[#090D16] border-gray-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={handleUpdateOCC}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-semibold disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isSubmitting ? 'Submitting to PostgreSQL...' : 'Save Changes (OCC Verified)'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Immutable Audit Trail */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-gray-400 uppercase">
                Append-Only Audit Log ({auditEvents.length} events)
              </span>
              <button
                onClick={loadAudit}
                className="text-xs font-mono text-blue-400 hover:underline flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>

            {isLoadingAudit ? (
              <div className="py-8 text-center font-mono text-xs text-gray-500">
                Loading audit trail...
              </div>
            ) : auditEvents.length === 0 ? (
              <div className="py-8 text-center font-mono text-xs text-gray-500">
                No audit events recorded yet.
              </div>
            ) : (
              <div className="relative border-l-2 border-gray-800 ml-3 space-y-5">
                {auditEvents.map((event) => (
                  <div key={event.id} className="relative pl-5 text-xs font-mono">
                    <div className="absolute -left-[9px] top-0.5 w-4 h-4 rounded-full bg-[#111827] border-2 border-blue-500 flex items-center justify-center" />
                    <div className="flex items-center justify-between text-gray-400 text-[11px]">
                      <div>
                        <strong className="text-white">{event.actor_name || event.actor_id}</strong>{' '}
                        <span>performed</span>{' '}
                        <span className="px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 font-bold border border-blue-800/40">
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

                    <div className="mt-1 text-[11px] text-gray-300">
                      Version transition:{' '}
                      <span className="text-amber-400 font-bold">
                        v{event.from_version ?? '-'}
                      </span>{' '}
                      →{' '}
                      <span className="text-emerald-400 font-bold">
                        v{event.to_version ?? '-'}
                      </span>
                      {event.from_status && event.to_status && (
                        <span className="ml-2 text-gray-400">
                          ({event.from_status} → {event.to_status})
                        </span>
                      )}
                    </div>

                    {event.payload && Object.keys(event.payload).length > 0 && (
                      <pre className="mt-1.5 p-2 rounded bg-[#090D16] border border-[#1F2937] text-[10px] text-gray-400 overflow-x-auto">
                        {JSON.stringify(event.payload, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Transactional Outbox Activity */}
        {activeTab === 'outbox' && (
          <div className="space-y-4 text-xs font-mono">
            <div className="p-4 rounded bg-[#111827] border border-[#1F2937] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">
                  Transactional Outbox Pattern (SKIP LOCKED)
                </span>
                <span className="text-[10px] text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                  ZERO REDIS DEPENDENCY
                </span>
              </div>
              <p className="text-gray-300 font-sans text-xs leading-relaxed">
                When this work item was mutated, outbox events were inserted into the <code className="text-blue-300">outbox_jobs</code> table within the exact same ACID transaction. Background workers poll with:
              </p>
              <pre className="p-2.5 rounded bg-[#090D16] text-[11px] text-gray-300 border border-gray-800 overflow-x-auto">
                {`SELECT * FROM outbox_jobs
WHERE status = 'PENDING' AND next_attempt_at <= NOW()
ORDER BY next_attempt_at ASC LIMIT 20
FOR UPDATE SKIP LOCKED;`}
              </pre>

              <button
                onClick={async () => {
                  setIsSubmitting(true);
                  try {
                    const res = await api.triggerOutboxBatch(10);
                    setSuccessBanner(
                      `Outbox processed ${res.processed_count} jobs (${res.success_count} success, duration: ${res.duration_ms} ms).`
                    );
                  } catch (e: any) {
                    setErrorBanner(e as ApiError);
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
              >
                Trigger On-Demand Outbox Batch Run
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: Operational Notes & Comments */}
        {activeTab === 'comments' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add operational handoff note..."
                className="flex-1 bg-[#111827] border border-[#1F2937] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-sans"
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
              />
              <button
                onClick={handleAddComment}
                className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs flex items-center gap-1"
              >
                <Send className="w-3 h-3" />
                <span>Post</span>
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {comments.map((c) => (
                <div key={c.id} className="p-3 rounded bg-[#111827] border border-[#1F2937]">
                  <div className="flex items-center justify-between text-gray-400 font-mono text-[10px] mb-1">
                    <strong className="text-white">{c.author_name || c.author_id}</strong>
                    <span>{new Date(c.created_at).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-gray-200 font-sans">{c.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 5-Way Concurrent Claim Race Modal */}
      {showRaceModal && (
        <RaceSimulationModal
          workItem={item}
          personas={personas}
          onClose={() => setShowRaceModal(false)}
          onItemUpdated={onItemUpdated}
        />
      )}

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
