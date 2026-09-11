from __future__ import annotations

from typing import Any

import requests


def execute_external_agent(
    endpoint_url: str,
    task: str,
    timeout_seconds: int = 30,
    headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    request_headers = {
        "Content-Type": "application/json",
    }

    if headers:
        request_headers.update(headers)

    try:
        response = requests.post(
            endpoint_url,
            json={"task": task},
            headers=request_headers,
            timeout=timeout_seconds,
        )

        response.raise_for_status()

    except requests.Timeout as exc:
        return {
            "status": "failed",
            "success": False,
            "failure_type": "timeout_failure",
            "endpoint_url": endpoint_url,
            "task": task,
            "http_status": None,
            "response": None,
            "error": str(exc),
        }

    except requests.ConnectionError as exc:
        return {
            "status": "failed",
            "success": False,
            "failure_type": "integration_failure",
            "endpoint_url": endpoint_url,
            "task": task,
            "http_status": None,
            "response": None,
            "error": str(exc),
        }

    except requests.HTTPError as exc:
        http_status = (
            exc.response.status_code
            if exc.response is not None
            else None
        )

        response_data = None

        if exc.response is not None:
            try:
                response_data = exc.response.json()
            except ValueError:
                response_data = {
                    "raw_text": exc.response.text
                }

        return {
            "status": "failed",
            "success": False,
            "failure_type": "upstream_failure",
            "endpoint_url": endpoint_url,
            "task": task,
            "http_status": http_status,
            "response": response_data,
            "error": str(exc),
        }

    except requests.RequestException as exc:
        return {
            "status": "failed",
            "success": False,
            "failure_type": "integration_failure",
            "endpoint_url": endpoint_url,
            "task": task,
            "http_status": None,
            "response": None,
            "error": str(exc),
        }

    try:
        response_data = response.json()

    except ValueError:
        response_data = {
            "raw_text": response.text
        }

    return {
        "status": "completed",
        "success": True,
        "failure_type": None,
        "endpoint_url": endpoint_url,
        "task": task,
        "http_status": response.status_code,
        "response": response_data,
        "error": None,
    }
def normalize_external_agent_response(
    execution_result: dict[str, Any],
) -> dict[str, Any]:
    if not execution_result.get("success"):
        return {
            "status": "failed",
            "success": False,
            "failure_type": execution_result.get(
                "failure_type",
                "integration_failure",
            ),
            "http_status": execution_result.get(
            "http_status"
            ),
            "result": "",
            "selected_tool": None,
            "approval_required": False,
            "agent_name": None,
            "raw_response": execution_result.get(
                "response"
            ),
            "error": execution_result.get(
                "error"
            ),
        }

    response_data = (
        execution_result.get("response")
    )

    if not isinstance(
        response_data,
        dict,
    ):
        return {
            "status": "failed",
            "success": False,
            "failure_type": "contract_failure",
            "result": "",
            "selected_tool": None,
            "approval_required": False,
            "agent_name": None,
            "raw_response": response_data,
            "error": (
                "External agent response must "
                "be a JSON object."
            ),
        }

    supported_fields = {
        "result",
        "output",
        "answer",
        "message",
        "raw_text",
        "selected_tool",
        "tool",
        "tool_name",
        "approval_required",
        "requires_approval",
        "status",
        "agent_name",
    }

    has_supported_field = any(
        field in response_data
        for field in supported_fields
    )

    if not has_supported_field:
        return {
            "status": "failed",
            "success": False,
            "failure_type": "contract_failure",
            "result": "",
            "selected_tool": None,
            "approval_required": False,
            "agent_name": None,
            "raw_response": response_data,
            "error": (
                "External agent returned an "
                "unsupported response contract."
            ),
        }

    result_text = (
        response_data.get("result")
        or response_data.get("output")
        or response_data.get("answer")
        or response_data.get("message")
        or response_data.get("raw_text")
        or ""
    )

    selected_tool = (
        response_data.get("selected_tool")
        or response_data.get("tool")
        or response_data.get("tool_name")
    )

    approval_required = bool(
        response_data.get(
            "approval_required",
            False,
        )
        or response_data.get(
            "requires_approval",
            False,
        )
    )

    external_status = str(
        response_data.get(
            "status",
            "completed",
        )
    )

    return {
        "status": external_status,
        "success": True,
        "failure_type": None,
        "result": str(result_text),
        "selected_tool": selected_tool,
        "approval_required": approval_required,
        "agent_name": response_data.get(
            "agent_name"
        ),
        "raw_response": response_data,
        "error": None,
    }
def map_external_tool_name(
    external_tool: str | None,
    tool_mapping: dict[str, str] | None = None,
) -> str | None:
    if external_tool is None:
        return None

    if not tool_mapping:
        return external_tool

    return tool_mapping.get(
        external_tool,
        external_tool,
    )        