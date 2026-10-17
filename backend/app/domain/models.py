from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict


class WorkItemStatus(str, Enum):
    TRIAGE = "TRIAGE"
    INVESTIGATING = "INVESTIGATING"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    BLOCKED = "BLOCKED"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class Priority(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class ApprovalStatus(str, Enum):
    NOT_REQUIRED = "NOT_REQUIRED"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class TeamRole(str, Enum):
    REQUESTER = "REQUESTER"
    OPERATOR = "OPERATOR"
    APPROVER = "APPROVER"
    LEAD = "LEAD"


class AuditEventAction(str, Enum):
    CREATED = "CREATED"
    CLAIMED = "CLAIMED"
    TRANSITIONED = "TRANSITIONED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    UPDATED = "UPDATED"
    COMMENT_ADDED = "COMMENT_ADDED"


class OutboxStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    DEAD_LETTER = "DEAD_LETTER"


# ==========================================
# Request Models
# ==========================================

class WorkItemCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = Field(default="")
    priority: Priority = Priority.MEDIUM
    owning_team_id: str
    requires_approval: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)


class WorkItemUpdate(BaseModel):
    expected_version: int = Field(..., ge=1, description="Current known version for Optimistic Concurrency Control")
    title: Optional[str] = Field(default=None, min_length=3, max_length=255)
    description: Optional[str] = None
    priority: Optional[Priority] = None
    metadata: Optional[Dict[str, Any]] = None


class WorkItemClaim(BaseModel):
    expected_version: Optional[int] = Field(default=None, ge=1, description="Optional expected version check")


class WorkItemTransition(BaseModel):
    expected_version: int = Field(..., ge=1, description="Optimistic Concurrency Control version check")
    target_status: WorkItemStatus
    reason: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class WorkItemApprove(BaseModel):
    expected_version: int = Field(..., ge=1, description="Optimistic Concurrency Control version check")
    decision: str = Field(default="APPROVED", pattern="^(APPROVED|REJECTED)$")
    comment: Optional[str] = None


class WorkItemCommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)


# ==========================================
# Response Models
# ==========================================

class TeamResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None


class PersonaResponse(BaseModel):
    id: str
    name: str
    email: str
    avatar_url: Optional[str] = None
    roles: Dict[str, str] = Field(default_factory=dict)  # team_id -> role


class WorkItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: Optional[str] = ""
    status: WorkItemStatus
    priority: Priority
    owning_team_id: str
    assignee_id: Optional[str] = None
    created_by_id: str
    requires_approval: bool
    approval_status: ApprovalStatus
    approved_by_id: Optional[str] = None
    approved_at: Optional[datetime] = None
    version: int
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime

    # Display enrichments
    assignee_name: Optional[str] = None
    creator_name: Optional[str] = None
    team_name: Optional[str] = None


class PaginatedWorkItemsResponse(BaseModel):
    items: List[WorkItemResponse]
    next_cursor: Optional[str] = None
    has_more: bool
    total_count: Optional[int] = None
    query_time_ms: float


class AuditEventResponse(BaseModel):
    id: int
    work_item_id: str
    actor_id: str
    action: str
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    from_version: Optional[int] = None
    to_version: Optional[int] = None
    payload: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    actor_name: Optional[str] = None


class CommentResponse(BaseModel):
    id: int
    work_item_id: str
    author_id: str
    content: str
    created_at: datetime
    author_name: Optional[str] = None


class OutboxProcessResult(BaseModel):
    processed_count: int
    success_count: int
    failed_count: int
    dead_letter_count: int
    duration_ms: float
