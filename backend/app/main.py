import os
import secrets
import uuid
from fastapi import Depends, FastAPI, File, Header, HTTPException, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy import select, text
from backend.app.db.models import Document
from fastapi.middleware.cors import CORSMiddleware
from backend.app.rate_limit import enforce_rate_limit

from backend.app.audit.logger import (
    list_audit_events,
    log_audit_event,
)
from backend.app.tools.registry import (
    execute_registered_tool,
    list_registered_tools,
)
from backend.app.external_agents.adapter import (
    execute_external_agent,
    normalize_external_agent_response,
    map_external_tool_name,
)
from backend.app.evaluations.manager import (
    add_test_case,
    create_test_suite,
    get_test_case,
    get_test_suite,
    list_test_suites,
    save_evaluation_result,
    get_evaluation_metrics,
    list_evaluation_results,
    delete_test_suite,
    start_test_suite_run,
    complete_test_suite_run,
    list_test_suite_runs,
    compare_latest_test_suite_runs,
    compare_latest_test_case_results,
    get_evaluation_failure_details,
    delete_test_case,
    calculate_reliability_score,
)
from backend.app.evaluations.test_generator import (
    GenerateTestsRequest,
    GenerateTestsResponse,
    generate_test_cases,
)
from backend.app.agents.workflow import enterprise_workflow
from backend.app.knowledge.document_loader import extract_document_text
from backend.app.knowledge.chunker import chunk_text
from backend.app.db.database import Base, SessionLocal, engine
from backend.app.approvals.manager import (
    approve_request,
    create_approval_request,
    get_approval_request,
    list_approval_requests,
    mark_request_executed,
    reject_request,
)
from backend.app.db import models
from backend.app.knowledge.vector_store import (
    build_vector_store,
    search_knowledge,
)
from backend.app.runs.tracker import (
    start_agent_run,
    complete_agent_run,
    fail_agent_run,
    list_agent_runs,
    get_agent_run_metrics,
    list_agent_traces,
)

app = FastAPI(
    title="Enterprise AI Platform",
    description="Enterprise AI Agent Reliability & Control Platform",
    version="0.3.0",
)
default_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

configured_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
]

allowed_origins = default_origins + configured_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
with engine.begin() as connection:
    connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

Base.metadata.create_all(bind=engine)
ROLE_LEVELS = {
    "viewer": 1,
    "operator": 2,
    "admin": 3,
}


def get_current_role(
    x_api_key: str | None = Header(default=None),
) -> str:
    if not x_api_key:
        raise HTTPException(
            status_code=401,
            detail="Missing API key.",
        )

    role_keys = {
        "viewer": os.getenv("VIEWER_API_KEY"),
        "operator": os.getenv("OPERATOR_API_KEY"),
        "admin": os.getenv("ADMIN_API_KEY"),
    }

    configured_keys = {
        role: key
        for role, key in role_keys.items()
        if key
    }

    if not configured_keys:
        raise HTTPException(
            status_code=503,
            detail="Platform authentication is not configured.",
        )

    for role, expected_key in configured_keys.items():
        if secrets.compare_digest(x_api_key, expected_key):
            return role

    raise HTTPException(
        status_code=401,
        detail="Invalid API key.",
    )


def require_role(minimum_role: str):
    if minimum_role not in ROLE_LEVELS:
        raise ValueError(
            f"Unknown role: {minimum_role}"
        )

    def role_dependency(
        current_role: str = Depends(get_current_role),
    ) -> str:
        if ROLE_LEVELS[current_role] < ROLE_LEVELS[minimum_role]:
            raise HTTPException(
                status_code=403,
                detail=f"{minimum_role} role required.",
            )

        return current_role

    return role_dependency
class TaskRequest(BaseModel):
    task: str
    document_id: int | None = None

class KnowledgeSearchRequest(BaseModel):
    query: str
    document_id: int | None = None

class ToolExecutionRequest(BaseModel):
    tool_name: str
class ExternalEvaluationRequest(BaseModel):
    endpoint_url: str
    timeout_seconds: int = 30
    tool_mapping: dict[str, str] | None = None
class ExternalSuiteRunRequest(BaseModel):
    endpoint_url: str
    timeout_seconds: int = 30
    tool_mapping: dict[str, str] | None = None

class ExternalAgentRequest(BaseModel):
    endpoint_url: str
    task: str
    timeout_seconds: int = 30
class GeneratedTestToSave(BaseModel):
    name: str
    input_prompt: str
    expected_tool: str | None = None
    expected_approval_required: bool | None = None
    min_evaluation_score: int | None = 80
    expected_response_contains: str | None = None


class SaveGeneratedTestsRequest(BaseModel):
    tests: list[GeneratedTestToSave]

@app.get("/")
def root():
    return {
        "name": "Enterprise AI Platform",
        "version": "0.3.0",
        "status": "running",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "backend",
    }
@app.post(
    "/evaluations/generate-tests",
    response_model=GenerateTestsResponse,
)
def generate_ai_tests(
    request: GenerateTestsRequest,
):
    try:
        return generate_test_cases(request)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )
@app.post(
    "/evaluations/test-suites/{suite_id}/generated-tests"
)
def save_generated_tests(
    suite_id: str,
    request: SaveGeneratedTestsRequest,
):
    suite = get_test_suite(suite_id)

    if suite is None:
        raise HTTPException(
            status_code=404,
            detail="Test suite not found.",
        )

    if not request.tests:
        raise HTTPException(
            status_code=400,
            detail="At least one generated test must be provided.",
        )

    saved_tests = []

    for test in request.tests:
        saved_test = add_test_case(
            suite_id=suite_id,
            name=test.name,
            input_prompt=test.input_prompt,
            expected_tool=test.expected_tool,
            expected_approval_required=test.expected_approval_required,
            min_evaluation_score=test.min_evaluation_score,
            expected_response_contains=test.expected_response_contains,
        )

        saved_tests.append(saved_test)

    return {
        "suite_id": suite_id,
        "saved_count": len(saved_tests),
        "saved_tests": saved_tests,
    }
def execute_agent_task(
    task: str,
    document_id: int | None = None,
) -> dict:
    run_info = start_agent_run(task)
    run_id = run_info["run_id"]

    try:
        result = enterprise_workflow.invoke(
            {
                "run_id": run_id,
                "task": task,
                "document_id": document_id,
                "tool_required": False,
                "selected_tool": "",
                "tool_arguments": {},
                "tool_result": {},
                "status": "received",
                "plan": "",
                "retrieved_context": "",
                "retrieved_sources": [],
                "analysis": "",
                "evaluation_score": 0,
                "evaluation_feedback": "",
                "retry_count": 0,
                "result": "",
                "citations": [],
            }
        )

    except Exception as exc:
        fail_agent_run(
            run_id=run_id,
            error_message=str(exc),
        )
        raise

    tool_result = result.get("tool_result") or {}

    approval_required = bool(
        tool_result.get("approval_required")
        or tool_result.get("requires_approval")
        or tool_result.get("status") == "approval_required"
    )

    approval_id = tool_result.get("approval_id")
    selected_tool = result.get("selected_tool") or None

    tool_used = bool(
        result.get("tool_required")
        and selected_tool
    )

    evaluation_score = result.get("evaluation_score")
    retry_count = result.get("retry_count", 0)

    run_metrics = complete_agent_run(
        run_id=run_id,
        selected_tool=selected_tool,
        tool_used=tool_used,
        model="gemini-3.6-flash",
        status="completed",
        evaluation_score=evaluation_score,
        retry_count=retry_count,
        approval_required=approval_required,
        approval_id=approval_id,
    )

    result["run_id"] = run_id
    result["run_metrics"] = run_metrics

    return result

@app.post("/external-agents/execute")
def execute_external_agent_endpoint(
    request: ExternalAgentRequest,
    http_request: Request,
    current_role: str = Depends(require_role("operator")),
):
    enforce_rate_limit(
        request=http_request,
        bucket="external-agent-execute",
        limit=10,
        window_seconds=60,
    )
    execution_result = execute_external_agent(
        endpoint_url=request.endpoint_url,
        task=request.task,
        timeout_seconds=request.timeout_seconds,
    )

    normalized_result = (
        normalize_external_agent_response(
            execution_result
        )
    )

    if not normalized_result.get("success"):
        raise HTTPException(
            status_code=502,
            detail={
                "message": "External agent execution failed.",
                "error": normalized_result.get(
                    "error"
                ),
            },
        )

    return normalized_result
@app.post(
    "/evaluations/test-cases/{case_id}/external-run"
)
def run_external_test_case(
    case_id: str,
    request: ExternalEvaluationRequest,
    http_request: Request,
    current_role: str = Depends(require_role("operator")),
):
    enforce_rate_limit(
        request=http_request,
        bucket="external-test-case-run",
        limit=10,
        window_seconds=60,
    )
    try:
        return execute_external_test_case_evaluation(
            case_id=case_id,
            endpoint_url=request.endpoint_url,
            timeout_seconds=request.timeout_seconds,
            tool_mapping=request.tool_mapping,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )
@app.post("/agent/run")
def run_agent(
    request: TaskRequest,
    http_request: Request,
):
    enforce_rate_limit(
        request=http_request,
        bucket="agent-run",
        limit=20,
        window_seconds=60,
    )
    try:
        return execute_agent_task(
            task=request.task,
            document_id=request.document_id,
        )

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Agent execution failed.",
        )


@app.post("/knowledge/upload")
async def upload_document(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No filename provided.",
        )

    allowed_extensions = (".pdf", ".txt")

    if not file.filename.lower().endswith(allowed_extensions):
        raise HTTPException(
            status_code=400,
            detail="Only PDF and TXT files are supported.",
        )

    file_bytes = await file.read()

    try:
        text = extract_document_text(
            filename=file.filename,
            file_bytes=file_bytes,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not process document: {str(exc)}",
        )

    if not text.strip():
        raise HTTPException(
            status_code=400,
            detail="No readable text was found in the document.",
        )

    chunks = chunk_text(text)

    try:
        build_vector_store(
    chunks=chunks,
    filename=file.filename,
    )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not build vector store: {str(exc)}",
        )

    return {
        "filename": file.filename,
        "status": "indexed",
        "characters_extracted": len(text),
        "chunks_created": len(chunks),
        "message": "Document embedded and added to vector search.",
    }


@app.post("/knowledge/search")
def knowledge_search(request: KnowledgeSearchRequest):
    results = search_knowledge(
        query=request.query,
        k=4,document_id=request.document_id,
    )

    return {
        "query": request.query,
        "results_found": len(results),
        "results": results,
    }
@app.get("/knowledge/documents")
def list_documents():
    with SessionLocal() as db:
        documents = db.scalars(
            select(Document).order_by(Document.created_at.desc())
        ).all()

        return {
            "documents": [
                {
                    "id": document.id,
                    "filename": document.filename,
                    "created_at": document.created_at,
                }
                for document in documents
            ]
        }
@app.delete("/knowledge/documents/{document_id}")
def delete_document(document_id: int):
    with SessionLocal() as db:
        document = db.get(Document, document_id)

        if document is None:
            raise HTTPException(
                status_code=404,
                detail="Document not found."
            )

        db.delete(document)
        db.commit()

        return {
            "document_id": document_id,
            "status": "deleted",
            "message": "Document and its chunks were deleted."
        }
@app.get("/tools")
def get_tools(
    current_role: str = Depends(require_role("operator")),
):
    return {
        "tools": list_registered_tools()
    }
@app.post("/tools/execute")
def execute_tool(request: ToolExecutionRequest):
    result = execute_registered_tool(
        tool_name=request.tool_name
    )

    if result["success"]:
        return result

    if result["status"] == "approval_required":
        approval = create_approval_request(
            tool_name=request.tool_name
        )

        raise HTTPException(
            status_code=202,
            detail={
                "status": "pending_approval",
                "approval": approval,
            },
        )

    if result["status"] == "blocked":
        raise HTTPException(
            status_code=404,
            detail=result,
        )

    raise HTTPException(
        status_code=500,
        detail=result,
    )
@app.get("/approvals")
def get_approvals(
    limit: int = 50,
    status: str | None = None,
):
    if limit < 1 or limit > 200:
        raise HTTPException(
            status_code=400,
            detail="Limit must be between 1 and 200.",
        )

    valid_statuses = {
        "pending",
        "approved",
        "rejected",
        "executed",
    }

    if status and status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=(
                "Status must be one of: "
                "pending, approved, rejected, executed."
            ),
        )

    approvals = list_approval_requests(
        limit=limit,
        status=status,
    )

    return {
        "count": len(approvals),
        "status_filter": status,
        "approvals": approvals,
    }
@app.get("/approvals/{approval_id}")
def get_approval(approval_id: str):
    approval = get_approval_request(approval_id)

    if approval is None:
        raise HTTPException(
            status_code=404,
            detail="Approval request not found.",
        )

    return approval
@app.get("/audit/events")
def get_audit_events(
    limit: int = 50,
    approval_id: str | None = None,
    tool_name: str | None = None,
    status: str | None = None,
    event_type: str | None = None,
):
    if limit < 1 or limit > 200:
        raise HTTPException(
            status_code=400,
            detail="Limit must be between 1 and 200.",
        )

    events = list_audit_events(
        limit=limit,
        approval_id=approval_id,
        tool_name=tool_name,
        status=status,
        event_type=event_type,
    )

    return {
        "count": len(events),
        "filters": {
            "approval_id": approval_id,
            "tool_name": tool_name,
            "status": status,
            "event_type": event_type,
        },
        "events": events,
    }
@app.get("/approvals/{approval_id}/timeline")
def get_approval_timeline(approval_id: str):
    approval = get_approval_request(approval_id)

    if approval is None:
        raise HTTPException(
            status_code=404,
            detail="Approval request not found.",
        )

    events = list_audit_events(
        limit=200,
        approval_id=approval_id,
    )

    events = sorted(
        events,
        key=lambda event: event["created_at"] or "",
    )

    return {
        "approval": approval,
        "event_count": len(events),
        "timeline": events,
    }
@app.post("/approvals/{approval_id}/approve")
def approve_approval(approval_id: str):
    approval = approve_request(approval_id)

    if approval is None:
        raise HTTPException(
            status_code=404,
            detail="Approval request not found.",
        )
    if approval.get("error") == "invalid_state_transition":
        raise HTTPException(
            status_code=409,
            detail=approval,
        )
    return approval


@app.post("/approvals/{approval_id}/reject")
def reject_approval(approval_id: str):
    approval = reject_request(approval_id)

    if approval is None:
        raise HTTPException(
            status_code=404,
            detail="Approval request not found.",
        )
    if approval.get("error") == "invalid_state_transition":
        raise HTTPException(
            status_code=409,
            detail=approval,
        )
    return approval
@app.post("/approvals/{approval_id}/execute")
def execute_approved_tool(approval_id: str):
    approval = get_approval_request(approval_id)

    if approval is None:
        raise HTTPException(
            status_code=404,
            detail="Approval request not found.",
        )

    if approval["status"] == "executed":
        raise HTTPException(
            status_code=409,
            detail="This approval has already been executed.",
        )

    if approval["status"] == "pending":
        raise HTTPException(
            status_code=403,
            detail="Approval request is still pending.",
        )

    if approval["status"] == "rejected":
        raise HTTPException(
            status_code=403,
            detail="Approval request was rejected.",
        )

    if approval["status"] != "approved":
        raise HTTPException(
            status_code=403,
            detail="Approval request is not authorized for execution.",
        )

    log_audit_event(
        event_type="tool_execution_started",
        status="started",
        approval_id=approval_id,
        tool_name=approval["tool_name"],
        details={
            "arguments": approval["arguments"],
        },
    )

    result = execute_registered_tool(
        tool_name=approval["tool_name"],
        approved=True,
        arguments=approval["arguments"],
    )

    if not result["success"]:
        log_audit_event(
            event_type="tool_execution_completed",
            status="failed",
            approval_id=approval_id,
            tool_name=approval["tool_name"],
            details={
                "result": result,
            },
        )

        raise HTTPException(
            status_code=500,
            detail=result,
        )

    log_audit_event(
        event_type="tool_execution_completed",
        status="success",
        approval_id=approval_id,
        tool_name=approval["tool_name"],
        details={
            "result": result,
        },
    )

    mark_request_executed(approval_id)

    return {
        "approval_id": approval_id,
        "approval_status": "executed",
        "execution": result,
    }
    return {
        "approval_id": approval_id,
        "approval_status": approval["status"],
        "execution": result,
    }
@app.get("/agent/runs")
def get_agent_runs(limit: int = 50):
    if limit < 1 or limit > 200:
        raise HTTPException(
            status_code=400,
            detail="Limit must be between 1 and 200.",
        )

    runs = list_agent_runs(limit=limit)

    return {
        "count": len(runs),
        "runs": runs,
    }
@app.get("/agent/metrics")
def get_agent_metrics(
    current_role: str = Depends(require_role("viewer")),
):
    return get_agent_run_metrics()
@app.get("/agent/runs/{run_id}/traces")
def get_agent_run_traces(run_id: str):
    traces = list_agent_traces(run_id)

    return {
        "run_id": run_id,
        "count": len(traces),
        "traces": traces,
    }
@app.post("/evaluations/test-suites")
def create_evaluation_test_suite(
    name: str,
    description: str = "",
):
    if not name.strip():
        raise HTTPException(
            status_code=400,
            detail="Test suite name is required.",
        )

    return create_test_suite(
        name=name.strip(),
        description=description.strip(),
    )


@app.get("/evaluations/test-suites")
def get_evaluation_test_suites(
    limit: int = 50,
):
    if limit < 1 or limit > 200:
        raise HTTPException(
            status_code=400,
            detail="Limit must be between 1 and 200.",
        )

    test_suites = list_test_suites(
        limit=limit,
    )

    return {
        "count": len(test_suites),
        "test_suites": test_suites,
    }


@app.get("/evaluations/test-suites/{suite_id}")
def get_evaluation_test_suite(
    suite_id: str,
):
    test_suite = get_test_suite(
        suite_id=suite_id,
    )

    if test_suite is None:
        raise HTTPException(
            status_code=404,
            detail="Test suite not found.",
        )

    return test_suite
@app.get("/evaluations/test-suite-runs")
def get_test_suite_run_history(
    suite_id: str | None = None,
    limit: int = 50,
):
    runs = list_test_suite_runs(
        suite_id=suite_id,
        limit=limit,
    )

    return {
        "count": len(runs),
        "suite_id_filter": suite_id,
        "runs": runs,
    }
@app.get(
    "/evaluations/test-suites/{suite_id}/regression"
)
def get_test_suite_regression(
    suite_id: str,
):
    test_suite = get_test_suite(suite_id)

    if test_suite is None:
        raise HTTPException(
            status_code=404,
            detail="Test suite not found.",
        )

    return compare_latest_test_suite_runs(
        suite_id=suite_id,
    )
@app.get(
    "/evaluations/test-suites/{suite_id}/case-regression"
)
def get_test_suite_case_regression(
    suite_id: str,
):
    test_suite = get_test_suite(suite_id)

    if test_suite is None:
        raise HTTPException(
            status_code=404,
            detail="Test suite not found.",
        )

    return compare_latest_test_case_results(
        suite_id=suite_id,
    )
@app.post("/evaluations/test-suites/{suite_id}/test-cases")
def create_evaluation_test_case(
    suite_id: str,
    name: str,
    input_prompt: str,
    expected_tool: str | None = None,
    expected_approval_required: bool | None = None,
    min_evaluation_score: int | None = None,
    expected_response_contains: str | None = None,
):
    if not name.strip():
        raise HTTPException(
            status_code=400,
            detail="Test case name is required.",
        )

    if not input_prompt.strip():
        raise HTTPException(
            status_code=400,
            detail="Test input prompt is required.",
        )

    if (
        min_evaluation_score is not None
        and not 0 <= min_evaluation_score <= 100
    ):
        raise HTTPException(
            status_code=400,
            detail="Minimum evaluation score must be between 0 and 100.",
        )

    test_case = add_test_case(
        suite_id=suite_id,
        name=name.strip(),
        input_prompt=input_prompt.strip(),
        expected_tool=expected_tool.strip()
        if expected_tool
        else None,
        expected_approval_required=expected_approval_required,
        min_evaluation_score=min_evaluation_score,
        expected_response_contains=(
            expected_response_contains.strip()
            if expected_response_contains
            else None
        ),
    )

    if test_case is None:
        raise HTTPException(
            status_code=404,
            detail="Test suite not found.",
        )

    return test_case
@app.delete("/evaluations/test-cases/{case_id}")
def delete_test_case_endpoint(
    case_id: str,
):
    deleted = delete_test_case(
        case_id=case_id
    )

    if not deleted:
        raise HTTPException(
            status_code=404,
            detail="Test case not found.",
        )

    return {
        "case_id": case_id,
        "status": "deleted",
    }
def execute_test_case_evaluation(
    case_id: str,
) -> dict:
    test_case = get_test_case(case_id)

    if test_case is None:
        raise HTTPException(
            status_code=404,
            detail="Test case not found.",
        )

    if not test_case["enabled"]:
        raise HTTPException(
            status_code=409,
            detail="Test case is disabled.",
        )

    try:
        agent_result = execute_agent_task(
            task=test_case["input_prompt"],
        )
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Evaluation test execution failed.",
        )

    run_metrics = (
        agent_result.get("run_metrics") or {}
    )

    actual_tool = (
        run_metrics.get("selected_tool")
        or agent_result.get("selected_tool")
    )

    actual_approval_required = bool(
        run_metrics.get(
            "approval_required",
            False,
        )
    )

    actual_evaluation_score = (
        run_metrics.get("evaluation_score")
    )
    actual_evaluation_feedback = str(
        agent_result.get("evaluation_feedback") or ""
    )

    checks = []

    expected_tool = test_case.get(
        "expected_tool"
    )

    if expected_tool is not None:
        passed = (
            actual_tool == expected_tool
        )

        checks.append(
            {
                "check": "tool_selection",
                "passed": passed,
                "expected": expected_tool,
                "actual": actual_tool,
            }
        )

    expected_approval = test_case.get(
        "expected_approval_required"
    )

    if expected_approval is not None:
        passed = (
            actual_approval_required
            == expected_approval
        )

        checks.append(
            {
                "check": "approval_requirement",
                "passed": passed,
                "expected": expected_approval,
                "actual": (
                    actual_approval_required
                ),
            }
        )

    minimum_score = test_case.get(
        "min_evaluation_score"
    )

    has_operational_assertions = (
        expected_tool is not None
        or expected_approval is not None
    )

    if (
        minimum_score is not None
        and not has_operational_assertions
    ):
        passed = (
            actual_evaluation_score
            is not None
            and actual_evaluation_score
            >= minimum_score
        )

        checks.append(
            {
                "check": "evaluation_score",
                "passed": passed,
                "expected": (
                    f">= {minimum_score}"
                ),
                "actual": (
                    actual_evaluation_score
                ),
            }
        )

    expected_text = test_case.get(
        "expected_response_contains"
    )

    if expected_text:
        final_response = str(
            agent_result.get("result")
            or ""
        )

        passed = (
            expected_text.lower()
            in final_response.lower()
        )

        checks.append(
            {
                "check": "response_contains",
                "passed": passed,
                "expected": expected_text,
                "actual": final_response,
            }
        )

    overall_passed = all(
        check["passed"]
        for check in checks
    )

    failed_checks = [
        check["check"]
        for check in checks
        if not check["passed"]
    ]

    saved_evaluation = (
        save_evaluation_result(
            case_id=test_case["case_id"],
            suite_id=test_case.get(
                "suite_id"
            ),
            run_id=agent_result.get(
                "run_id"
            ),
            status=(
                "passed"
                if overall_passed
                else "failed"
            ),
            passed=overall_passed,
            actual_tool=actual_tool,
            actual_approval_required=(
                actual_approval_required
            ),
            evaluation_score=(
                actual_evaluation_score
            ),
            evaluation_feedback=actual_evaluation_feedback,
            checks=checks,
            failed_checks=failed_checks,
        )
    )

    return {
        "evaluation_id": (
            saved_evaluation[
                "evaluation_id"
            ]
        ),
        "case_id": test_case["case_id"],
        "suite_id": test_case.get(
            "suite_id"
        ),
        "test_name": test_case["name"],
        "status": (
            "passed"
            if overall_passed
            else "failed"
        ),
        "passed": overall_passed,
        "failed_checks": failed_checks,
        "checks": checks,
        "run_id": agent_result.get(
            "run_id"
        ),
        "run_metrics": run_metrics,
    }
def execute_external_test_case_evaluation(
    case_id: str,
    endpoint_url: str,
    timeout_seconds: int = 30,
    tool_mapping: dict[str, str] | None = None,
) -> dict:
    test_case = get_test_case(
        case_id=case_id
    )

    if test_case is None:
        raise ValueError(
            "Test case not found."
        )

    external_run_id = str(uuid.uuid4())

    execution_result = execute_external_agent(
        endpoint_url=endpoint_url,
        task=test_case["input_prompt"],
        timeout_seconds=timeout_seconds,
    )

    normalized_result = (
        normalize_external_agent_response(
            execution_result
        )
    )

    # -------------------------------------------------
    # External execution failure handling
    # -------------------------------------------------
    if not normalized_result.get(
        "success",
        False,
    ):
        error_message = (
            normalized_result.get("error")
            or "External agent execution failed."
        )

        failure_type = normalized_result.get(
            "failure_type",
            "integration_failure",
        )

        if failure_type == "timeout_failure":
            failure_check = {
                "check": "external_agent_response_time",
                "expected": (
                    f"within_{timeout_seconds}_seconds"
                ),
                "actual": "timed_out",
                "passed": False,
            }

            evaluation_feedback = (
                "External agent timeout failure. "
                f"The agent did not respond within "
                f"{timeout_seconds} seconds. "
                f"{error_message}"
            )

        elif failure_type == "contract_failure":
            failure_check = {
                "check": "external_agent_response_contract",
                "expected": "valid_agent_response",
                "actual": "malformed_response",
                "passed": False,
            }

            evaluation_feedback = (
                "External agent response contract failure. "
                f"{error_message}"
            )

        elif failure_type == "upstream_failure":
            http_status = normalized_result.get(
                "http_status"
            )

            failure_check = {
                "check": "external_agent_upstream_service",
                "expected": "successful_http_response",
                "actual": (
                    f"http_{http_status}"
                    if http_status is not None
                    else "http_error"
                ),
                "passed": False,
            }

            evaluation_feedback = (
                "External agent upstream service failure. "
                f"HTTP status: "
                f"{http_status if http_status is not None else 'unknown'}. "
                f"{error_message}"
            )

        else:
            failure_type = "integration_failure"

            failure_check = {
                "check": "external_agent_connectivity",
                "expected": "reachable",
                "actual": "unreachable",
                "passed": False,
            }

            evaluation_feedback = (
                "External agent integration failure. "
                f"{error_message}"
            )

        saved_evaluation = (
            save_evaluation_result(
                case_id=test_case["case_id"],
                suite_id=test_case.get(
                    "suite_id"
                ),
                run_id=external_run_id,
                status="failed",
                passed=False,
                actual_tool=None,
                actual_approval_required=False,
                evaluation_score=None,
                evaluation_feedback=(
                    evaluation_feedback
                ),
                checks=[
                    failure_check
                ],
                failed_checks=[
                    failure_check
                ],
            )
        )

        return {
            "evaluation_id": (
                saved_evaluation[
                    "evaluation_id"
                ]
            ),
            "case_id": test_case["case_id"],
            "suite_id": test_case.get(
                "suite_id"
            ),
            "test_name": test_case["name"],
            "status": "failed",
            "passed": False,
            "failure_type": failure_type,
            "failed_checks": [
                failure_check
            ],
            "checks": [
                failure_check
            ],
            "run_id": external_run_id,
            "run_metrics": {},
            "agent_name": None,
            "external_tool": None,
            "actual_tool": None,
            "actual_approval_required": False,
            "result": "",
            "error": error_message,
        }

    # -------------------------------------------------
    # Successful external response evaluation
    # -------------------------------------------------
    external_tool = normalized_result.get(
        "selected_tool"
    )

    actual_tool = map_external_tool_name(
        external_tool=external_tool,
        tool_mapping=tool_mapping,
    )

    actual_approval_required = bool(
        normalized_result.get(
            "approval_required",
            False,
        )
    )

    checks = []
    failed_checks = []

    expected_tool = test_case.get(
        "expected_tool"
    )

    if expected_tool is not None:
        tool_passed = (
            actual_tool == expected_tool
        )

        check = {
            "check": "expected_tool",
            "expected": expected_tool,
            "actual": actual_tool,
            "passed": tool_passed,
        }

        checks.append(check)

        if not tool_passed:
            failed_checks.append(check)

    expected_approval_required = (
        test_case.get(
            "expected_approval_required"
        )
    )

    if expected_approval_required is not None:
        approval_passed = (
            actual_approval_required
            == expected_approval_required
        )

        check = {
            "check":
                "expected_approval_required",
            "expected":
                expected_approval_required,
            "actual":
                actual_approval_required,
            "passed":
                approval_passed,
        }

        checks.append(check)

        if not approval_passed:
            failed_checks.append(check)

    overall_passed = (
        len(failed_checks) == 0
    )

    external_feedback = (
        "External agent evaluation completed. "
        f"Agent: "
        f"{normalized_result.get('agent_name') or 'unknown'}. "
        f"External tool: "
        f"{external_tool or 'none'}. "
        f"Canonical tool: "
        f"{actual_tool or 'none'}."
    )

    saved_evaluation = (
        save_evaluation_result(
            case_id=test_case["case_id"],
            suite_id=test_case.get(
                "suite_id"
            ),
            run_id=external_run_id,
            status=(
                "passed"
                if overall_passed
                else "failed"
            ),
            passed=overall_passed,
            actual_tool=actual_tool,
            actual_approval_required=(
                actual_approval_required
            ),
            evaluation_score=None,
            evaluation_feedback=(
                external_feedback
            ),
            checks=checks,
            failed_checks=failed_checks,
        )
    )

    return {
        "evaluation_id": (
            saved_evaluation[
                "evaluation_id"
            ]
        ),
        "case_id": test_case["case_id"],
        "suite_id": test_case.get(
            "suite_id"
        ),
        "test_name": test_case["name"],
        "status": (
            "passed"
            if overall_passed
            else "failed"
        ),
        "passed": overall_passed,
        "failed_checks": failed_checks,
        "checks": checks,
        "run_id": external_run_id,
        "run_metrics": {},
        "agent_name": normalized_result.get(
            "agent_name"
        ),
        "external_tool": external_tool,
        "actual_tool": actual_tool,
        "actual_approval_required": (
            actual_approval_required
        ),
        "result": normalized_result.get(
            "result",
            ""
        ),
    }

@app.post(
    "/evaluations/test-cases/{case_id}/run"
)
def run_evaluation_test_case(
    case_id: str,
    http_request: Request,
):
 enforce_rate_limit(
        request=http_request,
        bucket="evaluation-test-case-run",
        limit=20,
        window_seconds=60,
    )
 return execute_test_case_evaluation(
        case_id
    )
@app.delete(
    "/evaluations/test-suites/{suite_id}"
)
def delete_evaluation_test_suite(
    suite_id: str,
):
    deleted_suite = delete_test_suite(
        suite_id
    )

    if deleted_suite is None:
        raise HTTPException(
            status_code=404,
            detail="Test suite not found.",
        )

    return {
        "message": (
            "Test suite deleted successfully."
        ),
        "suite_id": (
            deleted_suite["suite_id"]
        ),
        "name": deleted_suite["name"],
    }
@app.post("/evaluations/test-suites/{suite_id}/run")
def run_evaluation_test_suite(
    suite_id: str,
    http_request: Request,
):
    enforce_rate_limit(
        request=http_request,
        bucket="evaluation-test-suite-run",
        limit=5,
        window_seconds=60,
    )

    test_suite = get_test_suite(suite_id)

    if test_suite is None:
        raise HTTPException(
            status_code=404,
            detail="Test suite not found.",
        )

    enabled_cases = [
        case
        for case in test_suite.get(
            "test_cases",
            [],
        )
        if case.get("enabled", True)
    ]

    if not enabled_cases:
        raise HTTPException(
            status_code=409,
            detail=(
                "Test suite has no enabled "
                "test cases."
            ),
        )

    suite_run = start_test_suite_run(
        suite_id=suite_id,
        suite_name=test_suite["name"],
    )

    suite_run_id = suite_run[
        "suite_run_id"
    ]

    results = []

    for test_case in enabled_cases:
        try:
            evaluation_result = (
                execute_test_case_evaluation(
                    test_case["case_id"]
                )
            )

            results.append(
                evaluation_result
            )

        except HTTPException as exc:
            results.append(
                {
                    "evaluation_id": None,
                    "case_id": test_case[
                        "case_id"
                    ],
                    "suite_id": suite_id,
                    "test_name": test_case[
                        "name"
                    ],
                    "status": "failed",
                    "passed": False,
                    "failed_checks": [
                        "execution_error"
                    ],
                    "checks": [],
                    "run_id": None,
                    "run_metrics": {},
                    "error": str(exc.detail),
                }
            )

        except Exception as exc:
            results.append(
                {
                    "evaluation_id": None,
                    "case_id": test_case[
                        "case_id"
                    ],
                    "suite_id": suite_id,
                    "test_name": test_case[
                        "name"
                    ],
                    "status": "failed",
                    "passed": False,
                    "failed_checks": [
                        "execution_error"
                    ],
                    "checks": [],
                    "run_id": None,
                    "run_metrics": {},
                    "error": str(exc),
                }
            )

    total_tests = len(results)

    passed_tests = sum(
        1
        for result in results
        if result.get("passed") is True
    )

    failed_tests = (
        total_tests - passed_tests
    )

    pass_rate = round(
        (
            passed_tests
            / total_tests
        )
        * 100,
        1,
    )

    suite_status = (
        "passed"
        if failed_tests == 0
        else "failed"
    )

    completed_suite_run = (
        complete_test_suite_run(
            suite_run_id=suite_run_id,
            status=suite_status,
            total_tests=total_tests,
            passed_tests=passed_tests,
            failed_tests=failed_tests,
            pass_rate=pass_rate,
        )
    )

    return {
        "suite_run_id": suite_run_id,
        "suite_id": suite_id,
        "suite_name": test_suite["name"],
        "status": suite_status,
        "total_tests": total_tests,
        "passed_tests": passed_tests,
        "failed_tests": failed_tests,
        "pass_rate": pass_rate,
        "started_at": (
            completed_suite_run.get(
                "started_at"
            )
            if completed_suite_run
            else None
        ),
        "completed_at": (
            completed_suite_run.get(
                "completed_at"
            )
            if completed_suite_run
            else None
        ),
        "results": results,
    }
@app.post(
    "/evaluations/test-suites/{suite_id}/external-run"
)
def run_external_evaluation_test_suite(
    suite_id: str,
    request: ExternalSuiteRunRequest,
    http_request: Request,
    current_role: str = Depends(require_role("operator")),
):
    enforce_rate_limit(
        request=http_request,
        bucket="external-test-suite-run",
        limit=5,
        window_seconds=60,
    )
    test_suite = get_test_suite(suite_id)

    if test_suite is None:
        raise HTTPException(
            status_code=404,
            detail="Test suite not found.",
        )

    enabled_cases = [
        case
        for case in test_suite.get(
            "test_cases",
            [],
        )
        if case.get("enabled", True)
    ]

    if not enabled_cases:
        raise HTTPException(
            status_code=409,
            detail=(
                "Test suite has no enabled "
                "test cases."
            ),
        )

    suite_run = start_test_suite_run(
        suite_id=suite_id,
        suite_name=test_suite["name"],
    )

    suite_run_id = suite_run[
        "suite_run_id"
    ]

    results = []

    for test_case in enabled_cases:
        try:
            evaluation_result = (
                execute_external_test_case_evaluation(
                    case_id=test_case[
                        "case_id"
                    ],
                    endpoint_url=(
                        request.endpoint_url
                    ),
                    timeout_seconds=(
                        request.timeout_seconds
                    ),
                    tool_mapping=(
                        request.tool_mapping
                    ),
                )
            )

            results.append(
                evaluation_result
            )

        except HTTPException as exc:
            results.append(
                {
                    "evaluation_id": None,
                    "case_id": test_case[
                        "case_id"
                    ],
                    "suite_id": suite_id,
                    "test_name": test_case[
                        "name"
                    ],
                    "status": "failed",
                    "passed": False,
                    "failed_checks": [
                        "execution_error"
                    ],
                    "checks": [],
                    "run_id": None,
                    "run_metrics": {},
                    "error": str(exc.detail),
                }
            )

        except Exception as exc:
            results.append(
                {
                    "evaluation_id": None,
                    "case_id": test_case[
                        "case_id"
                    ],
                    "suite_id": suite_id,
                    "test_name": test_case[
                        "name"
                    ],
                    "status": "failed",
                    "passed": False,
                    "failed_checks": [
                        "execution_error"
                    ],
                    "checks": [],
                    "run_id": None,
                    "run_metrics": {},
                    "error": str(exc),
                }
            )

    total_tests = len(results)

    passed_tests = sum(
        1
        for result in results
        if result.get("passed") is True
    )

    failed_tests = (
        total_tests - passed_tests
    )

    pass_rate = round(
        (
            passed_tests
            / total_tests
        )
        * 100,
        1,
    )

    suite_status = (
        "passed"
        if failed_tests == 0
        else "failed"
    )

    completed_suite_run = (
        complete_test_suite_run(
            suite_run_id=suite_run_id,
            status=suite_status,
            total_tests=total_tests,
            passed_tests=passed_tests,
            failed_tests=failed_tests,
            pass_rate=pass_rate,
        )
    )

    return {
        "suite_run_id": suite_run_id,
        "suite_id": suite_id,
        "suite_name": test_suite[
            "name"
        ],
        "execution_type": "external_agent",
        "endpoint_url": (
            request.endpoint_url
        ),
        "status": suite_status,
        "total_tests": total_tests,
        "passed_tests": passed_tests,
        "failed_tests": failed_tests,
        "pass_rate": pass_rate,
        "started_at": (
            completed_suite_run.get(
                "started_at"
            )
            if completed_suite_run
            else None
        ),
        "completed_at": (
            completed_suite_run.get(
                "completed_at"
            )
            if completed_suite_run
            else None
        ),
        "results": results,
    }
@app.get("/evaluations/results")
def get_evaluation_results(
    limit: int = 50,
    status: str | None = None,
):
    if limit < 1 or limit > 200:
        raise HTTPException(
            status_code=400,
            detail="Limit must be between 1 and 200.",
        )

    valid_statuses = {
        "passed",
        "failed",
    }

    if status and status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=(
                "Status must be one of: "
                "passed, failed."
            ),
        )

    results = list_evaluation_results(
        limit=limit,
        status=status,
    )

    return {
        "count": len(results),
        "status_filter": status,
        "results": results,
    }
@app.get(
    "/evaluations/results/{evaluation_id}/failure-details"
)
def get_evaluation_failure_detail_endpoint(
    evaluation_id: str,
):
    details = get_evaluation_failure_details(
        evaluation_id=evaluation_id,
    )

    if details is None:
        raise HTTPException(
            status_code=404,
            detail="Evaluation result not found.",
        )

    return details

@app.get("/evaluations/metrics")
def get_evaluations_metrics():
    return get_evaluation_metrics()
@app.get(
    "/evaluations/test-suites/{suite_id}/reliability-score"
)
def get_reliability_score(
    suite_id: str,
):
    result = calculate_reliability_score(
        suite_id=suite_id
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Test suite not found.",
        )

    return result
