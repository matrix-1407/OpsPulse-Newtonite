import {
  WorkItem,
  PaginatedWorkItemsResponse,
  AuditEvent,
  Comment,
  Persona,
  Team,
  BenchmarkMetrics,
  OutboxProcessResult,
  RFCError,
  WorkItemStatus,
  Priority,
} from '../types';

const API_BASE = '/api/v1';

export class ApiError extends Error implements RFCError {
  code: string;
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

  constructor(rfc: RFCError) {
    super(rfc.message);
    this.name = 'ApiError';
    this.code = rfc.code;
    this.status_code = rfc.status_code;
    this.current_state = rfc.current_state;
    this.current_assignee_id = rfc.current_assignee_id;
    this.approval_status = rfc.approval_status;
    this.from_status = rfc.from_status;
    this.to_status = rfc.to_status;
    this.allowed_transitions = rfc.allowed_transitions;
    this.required_roles = rfc.required_roles;
    this.actual_role = rfc.actual_role;
    this.team_id = rfc.team_id;
    this.details = rfc.details;
  }
}

async function handleResponse<T>(
  res: Response
): Promise<{ data: T; isIdempotentReplay: boolean }> {
  const isIdempotentReplay = res.headers.get('X-Idempotent-Replay') === 'true';

  if (!res.ok) {
    let rfcError: RFCError;
    try {
      const errJson = await res.json();
      rfcError = {
        code: errJson.code || 'UNKNOWN_ERROR',
        message: errJson.message || `HTTP ${res.status}: ${res.statusText}`,
        status_code: res.status,
        ...errJson,
      };
    } catch {
      rfcError = {
        code: 'NETWORK_OR_PARSING_ERROR',
        message: `HTTP ${res.status}: ${res.statusText}`,
        status_code: res.status,
      };
    }
    throw new ApiError(rfcError);
  }

  const data = (await res.json()) as T;
  return { data, isIdempotentReplay };
}

export interface ListWorkItemsParams {
  cursor?: string | null;
  limit?: number;
  query?: string;
  status?: string;
  team_id?: string;
  priority?: string;
  assignee_id?: string;
}

export const api = {
  async fetchHealth(): Promise<{ status: string; total_work_items: number }> {
    const res = await fetch('/health');
    return (await res.json());
  },

  async fetchPersonas(): Promise<Persona[]> {
    const res = await fetch(`${API_BASE}/personas`);
    const { data } = await handleResponse<Persona[]>(res);
    return data;
  },

  async fetchTeams(): Promise<Team[]> {
    const res = await fetch(`${API_BASE}/teams`);
    const { data } = await handleResponse<Team[]>(res);
    return data;
  },

  async fetchWorkItems(
    params: ListWorkItemsParams = {},
    actorId = 'usr_aarav'
  ): Promise<PaginatedWorkItemsResponse> {
    const query = new URLSearchParams();
    if (params.cursor) query.set('cursor', params.cursor);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.query) query.set('query', params.query);
    if (params.status) query.set('status', params.status);
    if (params.team_id) query.set('team_id', params.team_id);
    if (params.priority) query.set('priority', params.priority);
    if (params.assignee_id) query.set('assignee_id', params.assignee_id);

    const res = await fetch(`${API_BASE}/work-items?${query.toString()}`, {
      headers: {
        'X-Actor-Id': actorId,
      },
    });
    const { data } = await handleResponse<PaginatedWorkItemsResponse>(res);
    return data;
  },

  async fetchWorkItem(id: string, actorId = 'usr_aarav'): Promise<WorkItem> {
    const res = await fetch(`${API_BASE}/work-items/${id}`, {
      headers: {
        'X-Actor-Id': actorId,
      },
    });
    const { data } = await handleResponse<WorkItem>(res);
    return data;
  },

  async createWorkItem(
    payload: {
      title: string;
      description?: string;
      priority?: Priority;
      owning_team_id: string;
      requires_approval?: boolean;
    },
    actorId = 'usr_aarav',
    idempotencyKey?: string
  ): Promise<{ item: WorkItem; isIdempotentReplay: boolean }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Actor-Id': actorId,
    };
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    const res = await fetch(`${API_BASE}/work-items`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const { data, isIdempotentReplay } = await handleResponse<WorkItem>(res);
    return { item: data, isIdempotentReplay };
  },

  async updateWorkItem(
    id: string,
    payload: {
      expected_version: number;
      title?: string;
      description?: string;
      priority?: Priority;
    },
    actorId = 'usr_aarav'
  ): Promise<WorkItem> {
    const res = await fetch(`${API_BASE}/work-items/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Actor-Id': actorId,
      },
      body: JSON.stringify(payload),
    });
    const { data } = await handleResponse<WorkItem>(res);
    return data;
  },

  async claimWorkItem(
    id: string,
    expected_version?: number,
    actorId = 'usr_aarav',
    idempotencyKey?: string
  ): Promise<{ item: WorkItem; isIdempotentReplay: boolean }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Actor-Id': actorId,
    };
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    const res = await fetch(`${API_BASE}/work-items/${id}/claim`, {
      method: 'POST',
      headers,
      body: JSON.stringify(expected_version ? { expected_version } : {}),
    });
    const { data, isIdempotentReplay } = await handleResponse<WorkItem>(res);
    return { item: data, isIdempotentReplay };
  },

  async transitionWorkItem(
    id: string,
    payload: {
      expected_version: number;
      target_status: WorkItemStatus;
      reason?: string;
    },
    actorId = 'usr_aarav',
    idempotencyKey?: string
  ): Promise<{ item: WorkItem; isIdempotentReplay: boolean }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Actor-Id': actorId,
    };
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    const res = await fetch(`${API_BASE}/work-items/${id}/transition`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const { data, isIdempotentReplay } = await handleResponse<WorkItem>(res);
    return { item: data, isIdempotentReplay };
  },

  async approveWorkItem(
    id: string,
    payload: {
      expected_version: number;
      decision: 'APPROVED' | 'REJECTED';
      comment?: string;
    },
    actorId = 'usr_priya',
    idempotencyKey?: string
  ): Promise<{ item: WorkItem; isIdempotentReplay: boolean }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Actor-Id': actorId,
    };
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    const res = await fetch(`${API_BASE}/work-items/${id}/approve`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const { data, isIdempotentReplay } = await handleResponse<WorkItem>(res);
    return { item: data, isIdempotentReplay };
  },

  async fetchAuditEvents(id: string): Promise<AuditEvent[]> {
    const res = await fetch(`${API_BASE}/work-items/${id}/audit`);
    const { data } = await handleResponse<AuditEvent[]>(res);
    return data;
  },

  async addComment(id: string, content: string, actorId = 'usr_aarav'): Promise<Comment> {
    const res = await fetch(`${API_BASE}/work-items/${id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Actor-Id': actorId,
      },
      body: JSON.stringify({ content }),
    });
    const { data } = await handleResponse<Comment>(res);
    return data;
  },

  async runBenchmarks(): Promise<BenchmarkMetrics> {
    const res = await fetch(`${API_BASE}/benchmarks/run`, {
      method: 'POST',
    });
    const { data } = await handleResponse<BenchmarkMetrics>(res);
    return data;
  },

  async triggerOutboxBatch(batchSize = 20): Promise<OutboxProcessResult> {
    const res = await fetch(
      `${API_BASE}/system/outbox/process-batch?batch_size=${batchSize}`,
      {
        method: 'POST',
      }
    );
    const { data } = await handleResponse<OutboxProcessResult>(res);
    return data;
  },
};
