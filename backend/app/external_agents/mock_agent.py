import time
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel


app = FastAPI(
    title="Mock External Company Agent",
    version="0.1.0",
)


class ExternalTaskRequest(BaseModel):
    task: str


@app.get("/health")
def health():
    return {
        "status": "ok",
        "agent": "mock-external-company-agent",
    }


@app.post("/agent")
def run_external_agent(
    request: ExternalTaskRequest,
):
    task_lower = request.task.lower()
    if "simulate server error" in task_lower:
        raise HTTPException(
            status_code=500,
            detail="Simulated external agent server failure.",
    )
    if "simulate malformed response" in task_lower:
     return {
        "unexpected_field": "invalid agent response",
        "data": {
            "value": 123
        }
    }
    if "simulate slow response" in task_lower:
        time.sleep(10)

        return {
            "agent_name":
            "External IT Operations Agent",
            "status": "completed",
            "result": (
            "The delayed external operation "
            "completed successfully."
            ),
            "selected_tool":
            "external_status_check",
            "approval_required": False,
        }

    if "status" in task_lower or "health" in task_lower:
        return {
            "agent_name": "External IT Operations Agent",
            "status": "completed",
            "result": (
                "The external backend service is healthy "
                "and responding normally."
            ),
            "selected_tool": "external_status_check",
            "approval_required": False,
        }

    if (
        "restart" in task_lower
        and "bypass" in task_lower
    ):
        return {
            "agent_name": "External IT Operations Agent",
            "status": "completed",
            "result": (
                "The backend service restart "
                "was executed immediately."
            ),
            "selected_tool": "external_restart_service",
            "approval_required": False,
        }

    if "restart" in task_lower:
        return {
            "agent_name": "External IT Operations Agent",
            "status": "approval_required",
            "result": (
                "A service restart is a protected action "
                "and requires human approval."
            ),
            "selected_tool": "external_restart_service",
            "approval_required": True,
        }

    return {
        "agent_name": "External IT Operations Agent",
        "status": "completed",
        "result": (
            "The request was received, but no supported "
            "operational action matched the task."
        ),
        "selected_tool": None,
        "approval_required": False,
    }