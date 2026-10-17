export type WorkItemStatus =
  | 'TRIAGE'
  | 'INVESTIGATING'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'BLOCKED'
  | 'RESOLVED'
  | 'CLOSED';

export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type ApprovalStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';

export type TeamRole = 'REQUESTER' | 'OPERATOR' | 'APPROVER' | 'LEAD';

export interface Persona {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  roles: Record<string, TeamRole | string>; // team_id -> role
}

export interface Team {
  id: string;
  name: string;
  description?: string | null;
  created_at?: string | null;
}

export interface WorkItem {
  id: string;
  title: string;
  description?: string;
  status: WorkItemStatus;
  priority: Priority;
  owning_team_id: string;
  assignee_id?: string | null;
  created_by_id: string;
  requires_approval: boolean;
  approval_status: ApprovalStatus;
  approved_by_id?: string | null;
  approved_at?: string | null;
  version: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;

  // Display enrichments
  assignee_name?: string | null;
  creator_name?: string | null;
  team_name?: string | null;
}

export interface PaginatedWorkItemsResponse {
  items: WorkItem[];
  next_cursor?: string | null;
  has_more: boolean;
  total_count?: number | null;
  query_time_ms: number;
}

export interface AuditEvent {
  id: number;
  work_item_id: string;
  actor_id: string;
  action: string;
  from_status?: string | null;
  to_status?: string | null;
  from_version?: number | null;
  to_version?: number | null;
  payload: Record<string, any>;
  created_at: string;
  actor_name?: string | null;
}

export interface Comment {
  id: number;
  work_item_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author_name?: string | null;
}

export interface RFCError {
  code: string;
  message: string;
  status_code: number;
  current_state?: WorkItem;
  current_assignee_id?: string;
  approval_status?: string;
  from_status?: string;
  to_status?: string;
  allowed_transitions?: string[];
  required_roles?: string[];
  actual_role?: string;
  team_id?: string;
  details?: any;
}

export interface BenchmarkMetrics {
  status: 'PASS' | 'FAIL';
  benchmark_timestamp: number;
  benchmarks: {
    full_text_search: {
      iterations: number;
      query_samples: string[];
      latency_ms: {
        p50: number;
        p95: number;
        p99: number;
        min: number;
        max: number;
        mean: number;
      };
      p99_guarantee_met: boolean;
      guarantee: string;
    };
    pagination_benchmark: {
      iterations: number;
      offset_5000: {
        p50_ms: number;
        p95_ms: number;
        p99_ms: number;
      };
      keyset_cursor: {
        p50_ms: number;
        p95_ms: number;
        p99_ms: number;
      };
      speedup_factor_p50: string;
      advantage: string;
    };
    concurrent_claim_race: {
      concurrent_claimants: number;
      winners: number;
      blocked_by_lock: number;
      errors: number;
      exclusive_win_guarantee: boolean;
      race_total_ms: number;
      claim_latency_ms: {
        p50: number;
        p95: number;
        p99: number;
      };
      winner_detail?: any;
      outcomes_summary: Array<{ actor: string; outcome: string }>;
      guarantee: string;
    };
    outbox_skip_locked: {
      processed_count: number;
      success_count: number;
      failed_count: number;
      dead_letter_count: number;
      latency_ms: number;
      pattern: string;
    };
    cleanup: {
      benchmark_items_deleted: number;
      tag: string;
    };
  };
}

export interface OutboxProcessResult {
  processed_count: number;
  success_count: number;
  failed_count: number;
  dead_letter_count: number;
  duration_ms: number;
}
