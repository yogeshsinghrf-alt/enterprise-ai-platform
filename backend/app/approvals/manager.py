import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import select

from backend.app.db.database import SessionLocal
from backend.app.db.models import ApprovalRequest
from backend.app.audit.logger import log_audit_event


def create_approval_request(
    tool_name: str,
    arguments: dict | None = None,
) -> dict:
    approval_id = str(uuid.uuid4())

    with SessionLocal() as db:
        approval = ApprovalRequest(
            approval_id=approval_id,
            tool_name=tool_name,
            arguments=json.dumps(arguments or {}),
            status="pending",
            created_at=datetime.now(timezone.utc),
            decided_at=None,
        )

        db.add(approval)
        db.commit()
        db.refresh(approval)
        log_audit_event(
        event_type="approval_created",
        status="pending",
        approval_id=approval.approval_id,
        tool_name=approval.tool_name,
        details={
        "arguments": arguments or {},
    },
    )    

        return _approval_to_dict(approval)


def get_approval_request(
    approval_id: str,
) -> dict | None:
    with SessionLocal() as db:
        approval = db.scalar(
            select(ApprovalRequest).where(
                ApprovalRequest.approval_id == approval_id
            )
        )

        if approval is None:
            return None

        return _approval_to_dict(approval)
def list_approval_requests(
    limit: int = 50,
    status: str | None = None,
) -> list[dict]:
    with SessionLocal() as db:
        query = select(ApprovalRequest)

        if status:
            query = query.where(
                ApprovalRequest.status == status
            )

        query = query.order_by(
            ApprovalRequest.created_at.desc()
        ).limit(limit)

        approvals = db.scalars(query).all()

        return [
            _approval_to_dict(approval)
            for approval in approvals
        ]

def approve_request(
    approval_id: str,
) -> dict | None:
    with SessionLocal() as db:
        approval = db.scalar(
            select(ApprovalRequest).where(
                ApprovalRequest.approval_id == approval_id
            )
        )

        if approval is None:
            return None

        if approval.status != "pending":
            return {
                "error": "invalid_state_transition",
                "current_status": approval.status,
                "requested_status": "approved",
            }

        approval.status = "approved"
        approval.decided_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(approval)

        log_audit_event(
            event_type="approval_decided",
            status="approved",
            approval_id=approval.approval_id,
            tool_name=approval.tool_name,
            details={
                "decision": "approved",
            },
        )

        return _approval_to_dict(approval)


def reject_request(
    approval_id: str,
) -> dict | None:
    with SessionLocal() as db:
        approval = db.scalar(
            select(ApprovalRequest).where(
                ApprovalRequest.approval_id == approval_id
            )
        )

        if approval is None:
            return None

        if approval.status != "pending":
            return {
                "error": "invalid_state_transition",
                "current_status": approval.status,
                "requested_status": "rejected",
            }

        approval.status = "rejected"
        approval.decided_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(approval)

        log_audit_event(
            event_type="approval_decided",
            status="rejected",
            approval_id=approval.approval_id,
            tool_name=approval.tool_name,
            details={
                "decision": "rejected",
            },
        )

        return _approval_to_dict(approval)


def _approval_to_dict(
    approval: ApprovalRequest,
) -> dict:
    return {
        "approval_id": approval.approval_id,
        "tool_name": approval.tool_name,
        "arguments": json.loads(approval.arguments or "{}"),
        "status": approval.status,
        "created_at": (
            approval.created_at.isoformat()
            if approval.created_at
            else None
        ),
        "decided_at": (
            approval.decided_at.isoformat()
            if approval.decided_at
            else None
        ),
        "executed_at": (
            approval.executed_at.isoformat()
            if approval.executed_at
            else None
        ),
    }
def mark_request_executed(
    approval_id: str,
) -> dict | None:
    with SessionLocal() as db:
        approval = db.scalar(
            select(ApprovalRequest).where(
                ApprovalRequest.approval_id == approval_id
            )
        )

        if approval is None:
            return None

        approval.status = "executed"
        approval.executed_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(approval)

        return _approval_to_dict(approval)    