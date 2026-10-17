from typing import Any, Dict, Optional


class AppException(Exception):
    """Base domain exception with RFC 7807 structured mapping."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}

    def to_dict(self) -> Dict[str, Any]:
        resp: Dict[str, Any] = {
            "code": self.code,
            "message": self.message,
        }
        if self.details:
            resp.update(self.details)
        return resp


class StaleVersionConflictError(AppException):
    """Raised when an OCC expected_version does not match current version in DB."""

    def __init__(self, expected_version: int, current_version: int, current_state: Dict[str, Any]):
        super().__init__(
            code="STALE_VERSION_CONFLICT",
            message=f"Conflict: Item was modified by another operator. Expected version {expected_version}, but current version is {current_version}.",
            status_code=409,
            details={"current_state": current_state},
        )


class AlreadyClaimedConflictError(AppException):
    """Raised when an operator attempts to claim an item already assigned to someone else."""

    def __init__(self, current_assignee_id: str, current_state: Dict[str, Any]):
        super().__init__(
            code="ALREADY_CLAIMED",
            message=f"Work item is already claimed by user {current_assignee_id}.",
            status_code=409,
            details={
                "current_assignee_id": current_assignee_id,
                "current_state": current_state,
            },
        )


class IdempotencyMismatchError(AppException):
    """Raised when the same Idempotency-Key is reused with a different payload."""

    def __init__(self, idempotency_key: str):
        super().__init__(
            code="IDEMPOTENCY_KEY_PAYLOAD_MISMATCH",
            message=f"Idempotency key '{idempotency_key}' was previously used with a different request payload.",
            status_code=422,
        )


class ApprovalGateLockedError(AppException):
    """Raised when attempting to resolve a work item whose required approval is not granted."""

    def __init__(self, current_approval_status: str):
        super().__init__(
            code="APPROVAL_GATE_LOCKED",
            message=f"Approval gate locked: work item requires approval and current status is '{current_approval_status}' (must be 'APPROVED' before resolving).",
            status_code=422,
            details={"approval_status": current_approval_status},
        )


class SeparationOfDutiesError(AppException):
    """Raised when an operator attempts to approve their own work item or an item they created."""

    def __init__(self, reason: str):
        super().__init__(
            code="SEPARATION_OF_DUTIES_VIOLATION",
            message=f"Separation of duties violation: {reason}",
            status_code=403,
        )


class PermissionDeniedError(AppException):
    """Raised when an actor lacks the required team role for an operation."""

    def __init__(self, required_roles: list[str], actual_role: Optional[str], team_id: str):
        super().__init__(
            code="PERMISSION_DENIED",
            message=f"Permission denied: action requires one of {required_roles} in team '{team_id}', but actor has '{actual_role or 'NO_ROLE'}'.",
            status_code=403,
            details={"required_roles": required_roles, "actual_role": actual_role, "team_id": team_id},
        )


class InvalidTransitionError(AppException):
    """Raised when a state machine transition is illegal."""

    def __init__(self, from_status: str, to_status: str, allowed: list[str]):
        super().__init__(
            code="INVALID_TRANSITION",
            message=f"Invalid workflow transition: cannot move from '{from_status}' to '{to_status}'. Allowed target statuses: {allowed}.",
            status_code=422,
            details={"from_status": from_status, "to_status": to_status, "allowed_transitions": allowed},
        )


class WorkItemNotFoundError(AppException):
    """Raised when a work item is not found."""

    def __init__(self, work_item_id: str):
        super().__init__(
            code="WORK_ITEM_NOT_FOUND",
            message=f"Work item with id '{work_item_id}' was not found.",
            status_code=404,
        )


class ActorNotFoundError(AppException):
    """Raised when the requesting actor id is unknown."""

    def __init__(self, actor_id: str):
        super().__init__(
            code="ACTOR_NOT_FOUND",
            message=f"Actor '{actor_id}' was not found in the system.",
            status_code=401,
        )
