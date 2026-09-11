from mcp.server.mcpserver import MCPServer

from backend.app.tools.registry import execute_registered_tool


mcp = MCPServer(
    "Enterprise AI Platform"
)


@mcp.tool()
def get_system_status() -> dict:
    """
    Return the current operational status
    of the Enterprise AI Platform.
    """

    return execute_registered_tool(
        "get_system_status"
    )


if __name__ == "__main__":
    mcp.run()