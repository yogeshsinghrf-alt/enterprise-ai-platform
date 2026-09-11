import uuid
import json
from datetime import datetime, timezone
from sqlalchemy import func

from backend.app.db.database import SessionLocal
from backend.app.db.models import AgentRun, AgentTrace


def start_agent_run(task: str) -> dict:
    run_id = str(uuid.uuid4())
    started_at = datetime.now(timezone.utc)

    with SessionLocal() as db:
        run = AgentRun(
            run_id=run_id,
            task=task,
            status="started",
            started_at=started_at,
        )

        db.add(run)
        db.commit()
        db.refresh(run)

    return {
        "run_id": run_id,
        "started_at": started_at,
    }


def complete_agent_run(
    run_id: str,
    selected_tool: str | None,
    tool_used: bool,
    model: str | None,
    status: str,
    evaluation_score: int | None,
    retry_count: int,
    approval_required: bool,
    approval_id: str | None,
) -> dict | None:
    completed_at = datetime.now(timezone.utc)

    with SessionLocal() as db:
        run = (
            db.query(AgentRun)
            .filter(AgentRun.run_id == run_id)
            .first()
        )

        if run is None:
            return None

        started_at = run.started_at

        if started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)

        latency_ms = int(
            (completed_at - started_at).total_seconds() * 1000
        )

        run.selected_tool = selected_tool
        run.tool_used = tool_used
        run.model = model
        run.status = status
        run.evaluation_score = evaluation_score
        run.retry_count = retry_count
        run.approval_required = approval_required
        run.approval_id = approval_id
        run.latency_ms = latency_ms
        run.completed_at = completed_at

        db.commit()
        db.refresh(run)

        return {
            "run_id": run.run_id,
            "status": run.status,
            "latency_ms": run.latency_ms,
            "evaluation_score": run.evaluation_score,
            "selected_tool": run.selected_tool,
            "approval_required": run.approval_required,
            "approval_id": run.approval_id,
        }
def list_agent_runs(limit: int = 50) -> list[dict]:
    with SessionLocal() as db:
        runs = (
            db.query(AgentRun)
            .order_by(AgentRun.started_at.desc())
            .limit(limit)
            .all()
        )

        return [
            {
                "run_id": run.run_id,
                "task": run.task,
                "selected_tool": run.selected_tool,
                "tool_used": run.tool_used,
                "model": run.model,
                "status": run.status,
                "evaluation_score": run.evaluation_score,
                "retry_count": run.retry_count,
                "approval_required": run.approval_required,
                "approval_id": run.approval_id,
                "latency_ms": run.latency_ms,
                "started_at": (
                    run.started_at.isoformat()
                    if run.started_at
                    else None
                ),
                "completed_at": (
                    run.completed_at.isoformat()
                    if run.completed_at
                    else None
                ),
            }
            for run in runs
        ]       
def get_agent_run_metrics() -> dict:
    with SessionLocal() as db:
        total_runs = db.query(func.count(AgentRun.id)).scalar() or 0

        completed_runs = (
            db.query(func.count(AgentRun.id))
            .filter(AgentRun.status == "completed")
            .scalar()
            or 0
        )

        failed_runs = (
            db.query(func.count(AgentRun.id))
            .filter(AgentRun.status == "failed")
            .scalar()
            or 0
        )

        tool_runs = (
            db.query(func.count(AgentRun.id))
            .filter(AgentRun.tool_used.is_(True))
            .scalar()
            or 0
        )

        approval_runs = (
            db.query(func.count(AgentRun.id))
            .filter(AgentRun.approval_required.is_(True))
            .scalar()
            or 0
        )

        avg_latency = (
            db.query(func.avg(AgentRun.latency_ms))
            .filter(AgentRun.latency_ms.isnot(None))
            .scalar()
        )

        avg_score = (
            db.query(func.avg(AgentRun.evaluation_score))
            .filter(AgentRun.evaluation_score.isnot(None))
            .scalar()
        )

        avg_retries = (
            db.query(func.avg(AgentRun.retry_count))
            .scalar()
        )

        success_rate = (
            round((completed_runs / total_runs) * 100, 2)
            if total_runs
            else 0
        )

        approval_rate = (
            round((approval_runs / total_runs) * 100, 2)
            if total_runs
            else 0
        )

        tool_usage_rate = (
            round((tool_runs / total_runs) * 100, 2)
            if total_runs
            else 0
        )

        return {
            "total_runs": total_runs,
            "completed_runs": completed_runs,
            "failed_runs": failed_runs,
            "success_rate_percent": success_rate,
            "average_latency_ms": (
                round(float(avg_latency), 2)
                if avg_latency is not None
                else 0
            ),
            "average_evaluation_score": (
                round(float(avg_score), 2)
                if avg_score is not None
                else 0
            ),
            "tool_runs": tool_runs,
            "tool_usage_rate_percent": tool_usage_rate,
            "approval_required_runs": approval_runs,
            "approval_rate_percent": approval_rate,
            "average_retry_count": (
                round(float(avg_retries), 2)
                if avg_retries is not None
                else 0
            ),
        }
def fail_agent_run(
    run_id: str,
    error_message: str | None = None,
) -> dict | None:
    completed_at = datetime.now(timezone.utc)

    with SessionLocal() as db:
        run = (
            db.query(AgentRun)
            .filter(AgentRun.run_id == run_id)
            .first()
        )

        if run is None:
            return None

        started_at = run.started_at

        if started_at.tzinfo is None:
            started_at = started_at.replace(
                tzinfo=timezone.utc
            )

        latency_ms = int(
            (completed_at - started_at).total_seconds() * 1000
        )

        run.status = "failed"
        run.latency_ms = latency_ms
        run.completed_at = completed_at

        db.commit()
        db.refresh(run)

        return {
            "run_id": run.run_id,
            "status": run.status,
            "latency_ms": run.latency_ms,
            "error": error_message,
        }         
def record_agent_trace(
    run_id: str,
    node_name: str,
    event_type: str,
    status: str,
    duration_ms: int | None = None,
    details: dict | None = None,
) -> dict:
    created_at = datetime.now(timezone.utc)

    safe_details = details or {}

    with SessionLocal() as db:
        trace = AgentTrace(
            run_id=run_id,
            node_name=node_name,
            event_type=event_type,
            status=status,
            duration_ms=duration_ms,
            details=json.dumps(safe_details),
            created_at=created_at,
        )

        db.add(trace)
        db.commit()
        db.refresh(trace)

        return {
            "id": trace.id,
            "run_id": trace.run_id,
            "node_name": trace.node_name,
            "event_type": trace.event_type,
            "status": trace.status,
            "duration_ms": trace.duration_ms,
            "details": safe_details,
            "created_at": trace.created_at.isoformat(),
        }    
def list_agent_traces(run_id: str) -> list[dict]:
    with SessionLocal() as db:
        traces = (
            db.query(AgentTrace)
            .filter(AgentTrace.run_id == run_id)
            .order_by(AgentTrace.created_at.asc())
            .all()
        )

        results = []

        for trace in traces:
            try:
                details = json.loads(trace.details or "{}")
            except json.JSONDecodeError:
                details = {}

            results.append(
                {
                    "id": trace.id,
                    "run_id": trace.run_id,
                    "node_name": trace.node_name,
                    "event_type": trace.event_type,
                    "status": trace.status,
                    "duration_ms": trace.duration_ms,
                    "details": details,
                    "created_at": (
                        trace.created_at.isoformat()
                        if trace.created_at
                        else None
                    ),
                }
            )

        return results        