from typing import Dict, List, Optional
from app.domain.errors import (
    ApprovalGateLockedError,
    InvalidTransitionError,
    PermissionDeniedError,
    SeparationOfDutiesError,
)
from app.domain.models import WorkItemStatus

# Deterministic Workflow State Graph
ALLOWED_TRANSITIONS: Dict[str, List[str]] = {
    WorkItemStatus.TRIAGE.value: [
        WorkItemStatus.INVESTIGATING.value,
        WorkItemStatus.BLOCKED.value,
        WorkItemStatus.CLOSED.value,
    ],
    WorkItemStatus.INVESTIGATING.value: [
        WorkItemStatus.PENDING_APPROVAL.value,
        WorkItemStatus.BLOCKED.value,
        WorkItemStatus.RESOLVED.value,
    ],
    WorkItemStatus.PENDING_APPROVAL.value: [
        WorkItemStatus.APPROVED.value,
        WorkItemStatus.INVESTIGATING.value,
        WorkItemStatus.BLOCKED.value,
    ],
    WorkItemStatus.APPROVED.value: [
        WorkItemStatus.RESOLVED.value,
        WorkItemStatus.INVESTIGATING.value,
        WorkItemStatus.BLOCKED.value,
    ],
    WorkItemStatus.BLOCKED.value: [
        WorkItemStatus.INVESTIGATING.value,
        WorkItemStatus.TRIAGE.value,
    ],
    WorkItemStatus.RESOLVED.value: [
        WorkItemStatus.CLOSED.value,
        WorkItemStatus.INVESTIGATING.value,
    ],
    WorkItemStatus.CLOSED.value: [],
}


def validate_transition(from_status: str, to_status: str) -> None:
    """Validate that moving from `from_status` to `to_status` is permitted."""
    allowed = ALLOWED_TRANSITIONS.get(from_status, [])
    if to_status not in allowed:
        raise InvalidTransitionError(
            from_status=from_status,
            to_status=to_status,
            allowed=allowed,
        )


def check_approval_gate(
    requires_approval: bool,
    approval_status: str,
    target_status: str,
) -> None:
    """
    Enforce Approval Gatekeeper:
    If requires_approval is True and approval_status != 'APPROVED',
    transitioning to RESOLVED MUST fail with APPROVAL_GATE_LOCKED.
    """
    if target_status == WorkItemStatus.RESOLVED.value:
        if requires_approval and approval_status != "APPROVED":
            raise ApprovalGateLockedError(current_approval_status=approval_status)


def check_separation_of_duties(
    actor_id: str,
    assignee_id: Optional[str],
    created_by_id: str,
) -> None:
    """
    Enforce Separation of Duties:
    An operator cannot approve their own work (actor != assignee)
    and cannot approve an item they created (actor != created_by).
    """
    if actor_id == assignee_id:
        raise SeparationOfDutiesError(
            f"Actor '{actor_id}' is the current assignee of this work item and cannot approve their own work."
        )
    if actor_id == created_by_id:
        raise SeparationOfDutiesError(
            f"Actor '{actor_id}' is the creator of this work item and cannot self-approve."
        )


def check_team_role(
    user_roles: Dict[str, str],
    team_id: str,
    allowed_roles: List[str],
) -> None:
    """Enforce resource-scoped RBAC: actor must possess an allowed role within the owning team."""
    actual_role = user_roles.get(team_id)
    if actual_role not in allowed_roles:
        raise PermissionDeniedError(
            required_roles=allowed_roles,
            actual_role=actual_role,
            team_id=team_id,
        )
