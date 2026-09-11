import json
from typing import Any, TypedDict
import time

from backend.app.runs.tracker import record_agent_trace

from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from backend.app.approvals.manager import create_approval_request
from langgraph.graph import END, START, StateGraph
from backend.app.tools.registry import (
    execute_registered_tool,
    list_registered_tools,
)

from backend.app.knowledge.vector_store import search_knowledge

load_dotenv()


class AgentState(TypedDict):
    task: str
    document_id: int | None
    run_id: str
    status: str
    plan: str
    retrieved_context: str
    retrieved_sources: list[dict[str, Any]]
    citations: list[dict[str, Any]]
    tool_required: bool
    selected_tool: str
    tool_arguments: dict
    tool_result: dict
    analysis: str
    evaluation_score: int
    evaluation_feedback: str
    retry_count: int
    result: str


llm = ChatGoogleGenerativeAI(
    model="gemini-3.6-flash",
)


def planner(state: AgentState):
    response = llm.invoke(
        f"""
You are an enterprise AI planning agent.

Business task:
{state["task"]}

Retrieved enterprise evidence:
{state["retrieved_context"]}

Create a concise analysis plan based on the available evidence.

Include:
1. Objective
2. Relevant evidence available
3. Information still missing
4. Analysis steps
5. Decision criteria

IMPORTANT:
- Do not claim that no enterprise knowledge is available if retrieved evidence is present.
- Do not invent information that is not in the retrieved evidence.
"""
    )

    return {
        "plan": response.content,
        "status": "planned",
    }
def tool_decision_node(state: AgentState):
    tools = list_registered_tools()

    tool_descriptions = "\n".join(
        [
            f"- {tool.get("name") or tool.get("tool_name")}: {tool['description']} "
            f"(risk={tool['risk_level']}, "
            f"requires_approval={tool['requires_approval']})"
            for tool in tools
        ]
    )

    prompt = f"""
You are the tool-routing component of an enterprise AI agent.

Decide whether the user's task requires one of the available enterprise tools.

User task:
{state['task']}

Current plan:
{state.get('plan', '')}

Available tools:
{tool_descriptions}

Rules:
Rules:
1. Determine whether the user is asking only for information,
   or asking the enterprise system to perform an action.

2. If the user explicitly requests an action that matches an
   available tool, you MUST select that tool.

3. Imperative action requests such as restart, stop, start,
   update, create, delete, deploy, change, execute, or modify
   normally require an enterprise tool when a matching tool exists.

4. Do NOT avoid selecting a tool because it is high-risk or
   requires approval. Risk and approval are enforced by the
   enterprise policy layer AFTER tool selection.

5. Your responsibility is tool ROUTING, not tool authorization.

6. For example, if an available tool is restart_service and the
   user asks to restart the backend service, return:
   tool_required=true,
   selected_tool="restart_service".

7. For informational requests requiring current operational
   state, select the appropriate read-only tool when available.

8. If the task can genuinely be answered without live data or
   performing an enterprise action, return tool_required=false.

9. Never invent a tool that is not in Available tools.

10. Select only one tool for now.

11. Return valid JSON only.

Required JSON format:

{{
  "tool_required": true,
  "selected_tool": "tool_name",
  "tool_arguments": {{}}
}}

Or:

{{
  "tool_required": false,
  "selected_tool": "",
  "tool_arguments": {{}}
}}
"""

    response = llm.invoke(prompt)

    content = response.content

    if isinstance(content, list):
        content = "".join(
            block.get("text", "")
            if isinstance(block, dict)
            else str(block)
            for block in content
        )

    content = content.strip()

    if content.startswith("```json"):
        content = content[7:]

    if content.startswith("```"):
        content = content[3:]

    if content.endswith("```"):
        content = content[:-3]

    try:
        decision = json.loads(content.strip())
    except json.JSONDecodeError:
        decision = {
            "tool_required": False,
            "selected_tool": "",
            "tool_arguments": {},
        }

    return {
        "tool_required": bool(
            decision.get("tool_required", False)
        ),
        "selected_tool": decision.get(
            "selected_tool",
            "",
        ),
        "tool_arguments": decision.get(
            "tool_arguments",
            {},
        ),
    }
def traced_tool_decision_node(state: AgentState):
    started = time.perf_counter()

    try:
        result = tool_decision_node(state)

        duration_ms = int(
            (time.perf_counter() - started) * 1000
        )

        record_agent_trace(
            run_id=state["run_id"],
            node_name="tool_decision",
            event_type="node_completed",
            status="completed",
            duration_ms=duration_ms,
            details={
                "tool_required": result.get(
                    "tool_required",
                    False,
                ),
                "selected_tool": result.get(
                    "selected_tool"
                ),
            },
        )

        return result

    except Exception as exc:
        duration_ms = int(
            (time.perf_counter() - started) * 1000
        )

        record_agent_trace(
            run_id=state["run_id"],
            node_name="tool_decision",
            event_type="node_failed",
            status="failed",
            duration_ms=duration_ms,
            details={
                "error_type": type(exc).__name__,
            },
        )

        raise    

def trace_node(
    node_name: str,
    node_function,
    details_builder=None,
):
    def wrapper(state: AgentState):
        started = time.perf_counter()

        try:
            result = node_function(state)

            duration_ms = int(
                (time.perf_counter() - started) * 1000
            )

            details = {}

            if details_builder:
                try:
                    details = details_builder(
                        state,
                        result,
                    ) or {}
                except Exception:
                    details = {}

            record_agent_trace(
                run_id=state["run_id"],
                node_name=node_name,
                event_type="node_completed",
                status="completed",
                duration_ms=duration_ms,
                details=details,
            )

            return result

        except Exception as exc:
            duration_ms = int(
                (time.perf_counter() - started) * 1000
            )

            record_agent_trace(
                run_id=state["run_id"],
                node_name=node_name,
                event_type="node_failed",
                status="failed",
                duration_ms=duration_ms,
                details={
                    "error_type": type(exc).__name__,
                },
            )

            raise

    return wrapper
def tool_execution_node(state: AgentState):
    tool_name = state.get("selected_tool", "")
    tool_arguments = state.get("tool_arguments", {})

    if not tool_name:
        return {
            "tool_result": {
                "success": False,
                "error": "No tool was selected.",
            }
        }

    result = execute_registered_tool(
        tool_name=tool_name,
        approved=False,
        arguments=tool_arguments,
    )

    approval_needed = (
        result.get("status") == "approval_required"
        or result.get("requires_approval") is True
        or result.get("approval_required") is True
    )

    if approval_needed:
        try:
            approval = create_approval_request(
                tool_name=tool_name,
                arguments=tool_arguments,
            )
        except Exception as exc:
            return {
                "tool_result": {
                    "success": False,
                    "status": "approval_creation_failed",
                    "tool": tool_name,
                    "error_type": type(exc).__name__,
                    "error": str(exc),
                }
            }

        return {
            "tool_result": {
                "success": False,
                "status": "approval_required",
                "approval_required": True,
                "approval_id": approval["approval_id"],
                "tool": tool_name,
                "risk_level": result.get("risk_level"),
                "requires_approval": True,
                "message": (
                    f"Tool '{tool_name}' requires human approval "
                    "before execution."
                ),
            }
        }

    return {
        "tool_result": result,
    }
def route_after_tool_decision(state: AgentState):
    if state.get("tool_required") and state.get("selected_tool"):
        return "tool_execution"

    return "analyst"    
def retrieve_knowledge(state: AgentState):
    results = search_knowledge(
        query=state["task"],
        k=4,document_id=state.get("document_id"),
    )

    if not results:
        return {
            "retrieved_context": "No relevant enterprise knowledge was retrieved.",
            "retrieved_sources": [],
            "status": "knowledge_retrieved",
        }

    context_blocks = []

    for source_number, item in enumerate(results, start=1):
        context_blocks.append(
            f"""
SOURCE {source_number}
Filename: {item["filename"]}
Chunk index: {item["chunk_index"]}
Chunk ID: {item["chunk_id"]}
Similarity score: {item["similarity_score"]}

Content:
{item["content"]}
""".strip()
        )

    context = "\n\n---\n\n".join(context_blocks)

    return {
        "retrieved_context": context,
        "retrieved_sources": results,
        "status": "knowledge_retrieved",
    }


def analyst(state: AgentState):
    feedback = state.get("evaluation_feedback", "")

    # Build enterprise tool evidence if a tool was executed.
    tool_context = ""

    if state.get("tool_result"):
        tool_context = f"""
Enterprise tool result:
{json.dumps(state['tool_result'], indent=2)}

Use this tool result as current operational evidence.
Do not invent values that are not present in the tool result.
"""

    response = llm.invoke(
        f"""
You are an enterprise business analyst.

Original task:
{state["task"]}

Analysis plan:
{state["plan"]}

Retrieved enterprise evidence:
{state["retrieved_context"]}

Enterprise tool evidence:
{tool_context if tool_context else "No enterprise tool was used for this task."}

Previous evaluator feedback:
{feedback if feedback else "None - this is the first analysis attempt."}

IMPORTANT RULES:
- Base the analysis on the available enterprise evidence and enterprise tool results.
- Treat enterprise tool results as current operational evidence.
- Do not invent unsupported facts.
- Clearly identify missing information.
- Separate evidence-based findings from assumptions.
- When making an important evidence-based statement from retrieved documents, reference the relevant source using [Source 1], [Source 2], etc.
- Do not fabricate source numbers.
- If retrieved document evidence is insufficient but a valid enterprise tool result answers the task, use the tool result.
- If both document evidence and tool evidence are insufficient, say so explicitly.

Return:
1. Evidence-based findings
2. Key risks
3. Missing information
4. Important assumptions
5. Preliminary recommendation
"""
    )

    return {
        "analysis": response.content,
        "status": "analyzed",
    }


def evaluator(state: AgentState):
    response = llm.invoke(
        f"""
You are an AI quality, groundedness and citation evaluator.

Evaluate the analysis against:

ORIGINAL TASK:
{state["task"]}

RETRIEVED EVIDENCE:
{state["retrieved_context"]}

ANALYSIS:
{state["analysis"]}

Score the analysis from 0 to 100.

Evaluate:
- relevance to the task
- completeness
- logical consistency
- risk identification
- usefulness for decision-making
- whether claims are supported by retrieved evidence
- whether unsupported assumptions are clearly identified
- whether important evidence-based claims contain valid source references
- whether cited source numbers actually exist in the retrieved evidence

Return ONLY valid JSON:

{{
  "score": 85,
  "feedback": "Short explanation of weaknesses or improvements."
}}
"""
    )

    # Gemini models may return either a string
    # or a list of structured content blocks.
    if isinstance(response.content, str):
        text = response.content

    elif isinstance(response.content, list):
        text_parts = []

        for block in response.content:
            if isinstance(block, str):
                text_parts.append(block)

            elif isinstance(block, dict):
                block_text = block.get("text")

                if block_text:
                    text_parts.append(block_text)

        text = "".join(text_parts)

    else:
        text = str(response.content)

    text = text.strip()

    if text.startswith("```"):
        text = (
            text
            .replace("```json", "")
            .replace("```", "")
            .strip()
        )

    try:
        evaluation = json.loads(text)

        score = int(evaluation["score"])
        feedback = str(evaluation["feedback"])

    except Exception:
        score = 0
        feedback = (
            "Evaluator returned a response that could not "
            "be parsed as valid JSON."
        )

    return {
        "evaluation_score": score,
        "evaluation_feedback": feedback,
        "status": "evaluated",
    }


def route_after_evaluation(state: AgentState):
    if state["evaluation_score"] >= 80:
        return "finalizer"

    if state["retry_count"] >= 1:
        return "finalizer"

    return "retry"


def prepare_retry(state: AgentState):
    return {
        "retry_count": state["retry_count"] + 1,
        "status": "retrying",
    }


def finalizer(state: AgentState):
    response = llm.invoke(
        f"""
You are a senior enterprise decision advisor.

Original task:
{state["task"]}

Retrieved evidence:
{state["retrieved_context"]}

Analysis:
{state["analysis"]}

Quality score:
{state["evaluation_score"]}/100

Evaluator feedback:
{state["evaluation_feedback"]}

Prepare the final executive response.

IMPORTANT RULES:
- Do not invent unsupported facts.
- Clearly state when evidence is insufficient.
- Distinguish facts from assumptions.
- Preserve useful source references such as [Source 1].
- Do not cite a source number that does not exist.
- Recommendations may involve professional judgment, but distinguish them from retrieved facts.

Return:
1. Executive summary
2. Evidence-based findings
3. Key risks
4. Recommendation
5. Recommended next actions
"""
    )

    citation_map = []

    for source_number, source in enumerate(
        state["retrieved_sources"],
        start=1,
    ):
        citation_map.append(
            {
                "source": source_number,
                "filename": source["filename"],
                "chunk_id": source["chunk_id"],
                "chunk_index": source["chunk_index"],
                "similarity_score": source["similarity_score"],
            }
        )

    return {
        "result": response.content,
        "citations": citation_map,
        "status": "completed",
    }

def tool_execution_trace_details(
    state: AgentState,
    result: dict,
):
    tool_result = result.get("tool_result") or {}

    return {
        "selected_tool": state.get("selected_tool"),
        "status": tool_result.get("status"),
        "risk_level": tool_result.get("risk_level"),
        "approval_required": bool(
            tool_result.get("approval_required")
            or tool_result.get("requires_approval")
            or tool_result.get("status") == "approval_required"
        ),
        "approval_id": tool_result.get("approval_id"),
    }


def evaluator_trace_details(
    state: AgentState,
    result: dict,
):
    return {
        "evaluation_score": result.get("evaluation_score"),
        "retry_count": state.get("retry_count", 0),
    }


def retrieval_trace_details(
    state: AgentState,
    result: dict,
):
    sources = result.get("retrieved_sources") or []

    return {
        "document_id": state.get("document_id"),
        "source_count": len(sources),
    }


def planner_trace_details(
    state: AgentState,
    result: dict,
):
    return {
        "plan_created": bool(result.get("plan")),
    }


def analyst_trace_details(
    state: AgentState,
    result: dict,
):
    return {
        "analysis_created": bool(result.get("analysis")),
    }


def finalizer_trace_details(
    state: AgentState,
    result: dict,
):
    return {
        "result_created": bool(result.get("result")),
    }
builder = StateGraph(AgentState)

builder.add_node(
    "planner",
    trace_node(
        "planner",
        planner,
        planner_trace_details,
    ),
)

builder.add_node(
    "retrieve_knowledge",
    trace_node(
        "retrieval",
        retrieve_knowledge,
        retrieval_trace_details,
    ),
)

builder.add_node(
    "analyst",
    trace_node(
        "analyst",
        analyst,
        analyst_trace_details,
    ),
)

builder.add_node(
    "evaluator",
    trace_node(
        "evaluator",
        evaluator,
        evaluator_trace_details,
    ),
)

builder.add_node(
    "prepare_retry",
    prepare_retry,
)

builder.add_node(
    "finalizer",
    trace_node(
        "finalizer",
        finalizer,
        finalizer_trace_details,
    ),
)

builder.add_node(
    "tool_decision",
    traced_tool_decision_node,
)

builder.add_node(
    "tool_execution",
    trace_node(
        "tool_execution",
        tool_execution_node,
        tool_execution_trace_details,
    ),
)
builder.add_edge(START, "retrieve_knowledge")
builder.add_edge("retrieve_knowledge", "planner")
builder.add_edge("planner", "tool_decision")
builder.add_conditional_edges(
    "tool_decision",
    route_after_tool_decision,
    {
        "tool_execution": "tool_execution",
        "analyst": "analyst",
    },
)

builder.add_edge("tool_execution", "analyst")
builder.add_edge("analyst", "evaluator")

builder.add_conditional_edges(
    "evaluator",
    route_after_evaluation,
    {
        "finalizer": "finalizer",
        "retry": "prepare_retry",
    },
)

builder.add_edge("prepare_retry", "analyst")
builder.add_edge("finalizer", END)

enterprise_workflow = builder.compile()