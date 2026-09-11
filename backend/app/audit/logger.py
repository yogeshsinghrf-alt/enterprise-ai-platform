import json
from datetime import datetime, timezone

from backend.app.db.database import SessionLocal
from backend.app.db.models import AuditEvent
from sqlalchemy import select


def log_audit_event(
    event_type: str,
    status: str,
    approval_id: str | None = None,
    tool_name: str | None = None,
    details: dict | None = None,
) -> dict:
    with SessionLocal() as db:
        event = AuditEvent(
            event_type=event_type,
            approval_id=approval_id,
            tool_name=tool_name,
            status=status,
            details=json.dumps(details or {}),
            created_at=datetime.now(timezone.utc),
        )

        db.add(event)
        db.commit()
        db.refresh(event)

        return {
            "id": event.id,
            "event_type": event.event_type,
            "approval_id": event.approval_id,
            "tool_name": event.tool_name,
            "status": event.status,
            "details": json.loads(event.details or "{}"),
            "created_at": (
                event.created_at.isoformat()
                if event.created_at
                else None
            ),
        }
def list_audit_events(
    limit: int = 50,
    approval_id: str | None = None,
    tool_name: str | None = None,
    status: str | None = None,
    event_type: str | None = None,
) -> list[dict]:
    with SessionLocal() as db:
        query = select(AuditEvent)

        if approval_id:
            query = query.where(
                AuditEvent.approval_id == approval_id
            )

        if tool_name:
            query = query.where(
                AuditEvent.tool_name == tool_name
            )

        if status:
            query = query.where(
                AuditEvent.status == status
            )

        if event_type:
            query = query.where(
                AuditEvent.event_type == event_type
            )

        query = (
            query
            .order_by(AuditEvent.created_at.desc())
            .limit(limit)
        )

        events = db.scalars(query).all()

        return [
            {
                "id": event.id,
                "event_type": event.event_type,
                "approval_id": event.approval_id,
                "tool_name": event.tool_name,
                "status": event.status,
                "details": json.loads(event.details or "{}"),
                "created_at": (
                    event.created_at.isoformat()
                    if event.created_at
                    else None
                ),
            }
            for event in events
        ]        