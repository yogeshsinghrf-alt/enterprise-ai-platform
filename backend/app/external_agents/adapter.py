import ipaddress
import os
import socket
from typing import Any
from urllib.parse import urlparse

import requests


def _get_allowed_external_hosts() -> set[str]:
    raw_hosts = os.getenv(
        "EXTERNAL_AGENT_ALLOWED_HOSTS",
        "",
    )

    return {
        host.strip().lower()
        for host in raw_hosts.split(",")
        if host.strip()
    }


def _validate_external_url(
    endpoint_url: str,
) -> tuple[bool, str | None]:
    try:
        parsed = urlparse(endpoint_url)
    except ValueError:
        return False, "Invalid external agent URL."

    if parsed.scheme not in {"http", "https"}:
        return (
            False,
            "Only http and https external agent URLs are allowed.",
        )

    if not parsed.hostname:
        return (
            False,
            "External agent URL must include a hostname.",
        )

    if parsed.username or parsed.password:
        return (
            False,
            "Credentials in external agent URLs are not allowed.",
        )

    hostname = parsed.hostname.lower()

    if hostname == "localhost":
        return (
            False,
            "Localhost external agent URLs are not allowed.",
        )

    allowed_hosts = _get_allowed_external_hosts()

    if not allowed_hosts:
        return (
            False,
            "No external agent hosts are allowlisted.",
        )

    if hostname not in allowed_hosts:
        return (
            False,
            "External agent host is not allowlisted.",
        )

    try:
        address_info = socket.getaddrinfo(
            hostname,
            parsed.port
            or (
                443
                if parsed.scheme == "https"
                else 80
            ),
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror:
        return (
            False,
            "External agent hostname could not be resolved.",
        )

    for entry in address_info:
        ip_text = entry[4][0]

        try:
            ip = ipaddress.ip_address(ip_text)
        except ValueError:
            return (
                False,
                "External agent resolved to an invalid IP address.",
            )

        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            return (
                False,
                "External agent resolved to a restricted network address.",
            )

    return True, None


def execute_external_agent(
    endpoint_url: str,
    task: str,
    timeout_seconds: int = 30,
    headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    is_valid, validation_error = _validate_external_url(
        endpoint_url
    )

    if not is_valid:
        return {
            "status": "failed",
            "success": False,
            "failure_type": "policy_failure",
            "endpoint_url": endpoint_url,
            "task": task,
            "http_status": None,
            "response": None,
            "error": validation_error,
        }

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
            allow_redirects=False,
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
            "error": execution_result.get(
                "error"
            ),
            "endpoint_url": execution_result.get(
                "endpoint_url"
            ),
        }

    response_data = execution_result.get(
        "response"
    )

    result_text = ""

    if isinstance(response_data, dict):
        result_text = str(
            response_data.get(
                "result",
                response_data.get(
                    "response",
                    response_data,
                ),
            )
        )
    else:
        result_text = str(
            response_data
        )

    return {
        "status": "completed",
        "success": True,
        "failure_type": None,
        "http_status": execution_result.get(
            "http_status"
        ),
        "result": result_text,
        "error": None,
        "endpoint_url": execution_result.get(
            "endpoint_url"
        ),
    }