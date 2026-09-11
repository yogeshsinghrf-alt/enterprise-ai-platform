import asyncio

from mcp import Client, StdioServerParameters


async def main():
    server = StdioServerParameters(
        command="python",
        args=[
            "-m",
            "backend.app.mcp_server.server",
        ],
    )

    async with Client(server) as client:
        tools = await client.list_tools()

        print("MCP tools discovered:")

        for tool in tools.tools:
            print(f"- {tool.name}")

        result = await client.call_tool(
            "get_system_status",
            {}
        )

        print("\nTool result:")
        print(result)


if __name__ == "__main__":
    asyncio.run(main())