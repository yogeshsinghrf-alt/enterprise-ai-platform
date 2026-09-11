from backend.app.tools.enterprise_tools import (
    get_system_status,
    restart_service,
    get_customer_account_status,
    get_purchase_order_status,
    approve_purchase_order,
)


TOOL_REGISTRY = {
    "get_system_status": {
        "name": "get_system_status",
        "description": (
            "Returns the current operational status "
            "of the Enterprise AI Platform."
        ),
        "risk_level": "low",
        "requires_approval": False,
        "function": get_system_status,
    },

    "restart_service": {
        "name": "restart_service",
        "description": (
            "Simulates restarting an enterprise service."
        ),
        "risk_level": "high",
        "requires_approval": True,
        "function": restart_service,
    },

    "get_customer_account_status": {
        "name": "get_customer_account_status",
        "description": (
            "Returns the current customer account status "
            "and whether there are active service issues."
        ),
        "risk_level": "low",
        "requires_approval": False,
        "function": get_customer_account_status,
    },

    "get_purchase_order_status": {
        "name": "get_purchase_order_status",
        "description": (
            "Returns the current status and details "
            "of a purchase order."
        ),
        "risk_level": "low",
        "requires_approval": False,
        "function": get_purchase_order_status,
    },

    "approve_purchase_order": {
        "name": "approve_purchase_order",
        "description": (
            "Simulates approving a purchase order. "
            "This is a protected financial action."
        ),
        "risk_level": "high",
        "requires_approval": True,
        "function": approve_purchase_order,
    },
}


def list_registered_tools():
    return [
        {
            "name": tool["name"],
            "description": tool["description"],
            "risk_level": tool["risk_level"],
            "requires_approval": tool["requires_approval"],
        }
        for tool in TOOL_REGISTRY.values()
    ]


def execute_registered_tool(
    tool_name: str,
    approved: bool = False,
    arguments: dict | None = None,
) -> dict:

    tool = TOOL_REGISTRY.get(tool_name)

    if tool is None:
        return {
            "success": False,
            "status": "blocked",
            "error": "Tool is not registered.",
        }

    if tool["requires_approval"] and not approved:
        return {
            "success": False,
            "status": "approval_required",
            "tool": tool_name,
            "risk_level": tool["risk_level"],
            "requires_approval": True,
            "error": (
                "Human approval is required before "
                "this tool can execute."
            ),
        }

    try:
        arguments = arguments or {}

        result = tool["function"](**arguments)

        return {
            "success": True,
            "status": "executed",
            "tool": tool_name,
            "risk_level": tool["risk_level"],
            "requires_approval": tool["requires_approval"],
            "result": result,
        }

    except Exception as exc:
        return {
            "success": False,
            "status": "failed",
            "tool": tool_name,
            "error": str(exc),
        }