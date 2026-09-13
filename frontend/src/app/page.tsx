"use client";

import { useEffect, useState } from "react";
const API_BASE_URL = "/api/backend?path=";

type Metrics = {
  total_runs: number;
  completed_runs: number;
  failed_runs: number;
  success_rate_percent: number;
  average_latency_ms: number;
  average_evaluation_score: number;
  tool_runs: number;
  tool_usage_rate_percent: number;
  approval_required_runs: number;
  approval_rate_percent: number;
  average_retry_count: number;
};

type AgentRun = {
  run_id: string;
  task: string;
  selected_tool: string | null;
  tool_used: boolean;
  model: string | null;
  status: string;
  evaluation_score: number | null;
  retry_count: number;
  approval_required: boolean;
  approval_id: string | null;
  latency_ms: number | null;
  started_at: string | null;
  completed_at: string | null;
};
type AgentTrace = {
  id: number;
  run_id: string;
  node_name: string;
  event_type: string;
  status: string;
  duration_ms: number | null;
  details: Record<string, unknown>;
  created_at: string | null;
};
type ApprovalTimelineEvent = {
  id?: number;
  event_type: string;
  approval_id: string | null;
  tool_name: string | null;
  status: string;
  details: Record<string, unknown>;
  created_at: string | null;
};
type ApprovalRequest = {
  approval_id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  status: string;
  created_at: string | null;
  decided_at: string | null;
  executed_at: string | null;
};
type EvaluationMetrics = {
  total_evaluations: number;
  passed: number;
  failed: number;
  pass_rate: number;
  average_evaluation_score: number | null;
};
type EvaluationFailureDetails = {
  evaluation_id: string;
  suite_id: string | null;
  case_id: string;
  test_name: string;
  input_prompt: string | null;
  status: string;
  passed: boolean;
  run_id: string;
  actual_tool: string | null;
  actual_approval_required: boolean;
  evaluation_score: number | null;
  evaluation_feedback: string;
  checks: EvaluationCheck[];
  failed_checks: string[];
  created_at: string | null;
};
type FailureExplorerTrace = {
  id: number;
  run_id: string;
  node_name: string;
  event_type: string;
  status: string;
  duration_ms: number | null;
  details: Record<string, unknown> | null;
  created_at: string | null;
};
type EvaluationCheck = {
  check: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
};

type EvaluationResult = {
  evaluation_id: string;
  case_id: string;
  suite_id: string | null;
  run_id: string;
  status: string;
  passed: boolean;
  actual_tool: string | null;
  actual_approval_required: boolean;
  evaluation_score: number | null;
  checks: EvaluationCheck[];
  failed_checks: string[];
  created_at: string | null;
};
type TestCase = {
  case_id: string;
  name: string;
  input_prompt: string;
  expected_tool: string | null;
  expected_approval_required: boolean | null;
  min_evaluation_score: number | null;
  expected_response_contains: string | null;
  enabled: boolean;
  created_at: string | null;
  updated_at: string | null;
};
type GeneratedTestCase = {
  name: string;
  input_prompt: string;
  expected_tool: string | null;
  expected_approval_required: boolean | null;
  min_evaluation_score: number | null;
  expected_response_contains: string | null;
  category: string;
  rationale: string;
};

type GenerateTestsResponse = {
  agent_name: string;
  generated_tests: GeneratedTestCase[];
  total_tests: number;
};
type ReliabilityScore = {
  suite_id: string;
  suite_name: string;
  score: number;
  readiness: string;
  pass_rate: number;
  average_evaluation_score: number;
  policy_compliance_rate: number;
  regression_stability: number;
};
type TestSuite = {
  suite_id: string;
  name: string;
  description: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  test_cases: TestCase[];
};

type TestSuiteRunResult = {
  suite_id: string;
  suite_name: string;
  status: string;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  pass_rate: number;
  results: Array<{
    evaluation_id: string | null;
    case_id: string;
    suite_id: string | null;
    test_name: string;
    status: string;
    passed: boolean;
    failed_checks: string[];
    checks: EvaluationCheck[];
    run_id: string | null;
    run_metrics: Record<string, unknown>;
    error?: string;
  }>;
};
type TestSuiteRunHistoryItem = {
  suite_run_id: string;
  suite_id: string;
  suite_name: string;
  status: string;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  pass_rate: number;
  started_at: string | null;
  completed_at: string | null;
};
type TestSuiteRegression = {
  suite_id: string;
  status:
    | "improved"
    | "stable"
    | "regressed"
    | "first_run"
    | "no_runs";
  current_run: TestSuiteRunHistoryItem | null;
  previous_run: TestSuiteRunHistoryItem | null;
  pass_rate_change: number | null;
  failed_tests_change: number | null;
  message?: string;
};
type TestCaseRegressionItem = {
  case_id: string;
  case_name: string;
  previous_passed: boolean;
  current_passed: boolean;
  previous_score: number | null;
  current_score: number | null;
};

type TestCaseRegression = {
  suite_id: string;
  status:
    | "improved"
    | "stable"
    | "regressed"
    | "first_run"
    | "no_runs";
  current_suite_run_id?: string;
  previous_suite_run_id?: string;
  regression_count?: number;
  improvement_count?: number;
  stable_count?: number;
  regressions: TestCaseRegressionItem[];
  improvements: TestCaseRegressionItem[];
  stable_cases: TestCaseRegressionItem[];
};
export default function Home() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [activeView, setActiveView] =
  useState<
  "overview" |
  "agent-runs" |
  "approvals" |
  "evaluations" |
  "test-suites"
  >("overview");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);
  const [traces, setTraces] = useState<AgentTrace[]>([]);
  const [traceLoading, setTraceLoading] = useState(false);
  const [approvalActionLoading, setApprovalActionLoading] =
  useState(false);
  const [approvalFilter, setApprovalFilter] =
  useState<"all" | "pending" | "approved" | "executed" | "rejected">("all");

  const [approvalStatus, setApprovalStatus] =
  useState<string | null>(null);

  const [approvalMessage, setApprovalMessage] =
  useState("");
  const [approvalTimeline, setApprovalTimeline] =
  useState<ApprovalTimelineEvent[]>([]);

  const [approvalTimelineLoading, setApprovalTimelineLoading] =
  useState(false);
  const [approvals, setApprovals] =
  useState<ApprovalRequest[]>([]);

  const [approvalsLoading, setApprovalsLoading] =
  useState(false);

  const [approvalsError, setApprovalsError] =
  useState("");
  const [selectedApproval, setSelectedApproval] =
  useState<ApprovalRequest | null>(null);

  const [selectedApprovalTimeline, setSelectedApprovalTimeline] =
  useState<ApprovalTimelineEvent[]>([]);

  const [selectedApprovalLoading, setSelectedApprovalLoading] =
  useState(false);

  const [selectedApprovalMessage, setSelectedApprovalMessage] =
  useState("");
  const [evaluationMetrics, setEvaluationMetrics] =
  useState<EvaluationMetrics | null>(null);

  const [evaluationResults, setEvaluationResults] =
  useState<EvaluationResult[]>([]);
  const [selectedEvaluation, setSelectedEvaluation] =
  useState<EvaluationResult | null>(null);
  const [evaluationsLoading, setEvaluationsLoading] =
  useState(false);

  const [evaluationsError, setEvaluationsError] =
  useState("");
  const [selectedFailureDetails, setSelectedFailureDetails] =
  useState<EvaluationFailureDetails | null>(null);

  const [failureDetailsLoading, setFailureDetailsLoading] =
  useState(false);

  const [failureDetailsError, setFailureDetailsError] =
  useState("");
  const [failureExplorerTraces, setFailureExplorerTraces] =
  useState<FailureExplorerTrace[]>([]);

  const [failureExplorerTracesLoading, setFailureExplorerTracesLoading] =
  useState(false);

  const [failureExplorerTracesError, setFailureExplorerTracesError] =
  useState("");
  const [testSuites, setTestSuites] =
  useState<TestSuite[]>([]);

  const [testSuitesLoading, setTestSuitesLoading] =
  useState(false);

  const [testSuitesError, setTestSuitesError] =
  useState("");
  const [runningSuiteId, setRunningSuiteId] =
  useState<string | null>(null);

  const [suiteRunResults, setSuiteRunResults] =
  useState<Record<string, TestSuiteRunResult>>({});

  const [suiteRunError, setSuiteRunError] =
  useState("");
  const [suiteRunHistory, setSuiteRunHistory] =
  useState<TestSuiteRunHistoryItem[]>([]);

  const [suiteRunHistoryLoading, setSuiteRunHistoryLoading] =
  useState(false);

  const [suiteRunHistoryError, setSuiteRunHistoryError] =
  useState("");
  const [suiteRegressions, setSuiteRegressions] =
  useState<Record<string, TestSuiteRegression>>({});

  const [suiteRegressionLoading, setSuiteRegressionLoading] =
  useState<Record<string, boolean>>({});
  const [caseRegressions, setCaseRegressions] =
  useState<Record<string, TestCaseRegression>>({});

  const [caseRegressionLoading, setCaseRegressionLoading] =
  useState<Record<string, boolean>>({});
  const [reliabilityScores, setReliabilityScores] =
  useState<Record<string, ReliabilityScore>>({});

  const [reliabilityScoreLoading, setReliabilityScoreLoading] =
  useState<Record<string, boolean>>({});
  const [testGeneratorSuiteId, setTestGeneratorSuiteId] =
  useState<string | null>(null);

  const [testGeneratorAgentName, setTestGeneratorAgentName] =
  useState("IT Operations Agent");

  const [
  testGeneratorAgentDescription,
  setTestGeneratorAgentDescription,
] = useState(
  "An enterprise AI agent that checks backend service status and can request protected service restarts. Service restarts require human approval."
);

  const [testGeneratorAvailableTools, setTestGeneratorAvailableTools] =
  useState("get_system_status, restart_service");

  const [testGeneratorProtectedTools, setTestGeneratorProtectedTools] =
  useState("restart_service");

  const [testGeneratorCount, setTestGeneratorCount] =
  useState(5);

  const [generatedTests, setGeneratedTests] =
  useState<GeneratedTestCase[]>([]);

  const [selectedGeneratedTests, setSelectedGeneratedTests] =
  useState<number[]>([]);

  const [testGeneratorLoading, setTestGeneratorLoading] =
  useState(false);

  const [testGeneratorSaving, setTestGeneratorSaving] =
  useState(false);

  const [testGeneratorError, setTestGeneratorError] =
  useState("");

  const [testGeneratorMessage, setTestGeneratorMessage] =
  useState("");

useEffect(() => {
  if (!authenticated) {
    setLoading(false);
    return;
  }

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const [metricsResponse, runsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/agent/metrics`),
        fetch(`${API_BASE_URL}/agent/runs?limit=20`),
      ]);

      if (!metricsResponse.ok || !runsResponse.ok) {
        throw new Error("Failed to load dashboard data");
      }

      const metricsData = await metricsResponse.json();
      const runsData = await runsResponse.json();

      setMetrics(metricsData);
      setRuns(runsData.runs ?? []);
    } catch (err) {
      console.error(err);
      setError("Could not connect to backend.");
    } finally {
      setLoading(false);
    }
  }

  loadDashboard();
}, [authenticated]);
async function loadEvaluations() {
  setEvaluationsLoading(true);
  setEvaluationsError("");

  try {
    const [metricsResponse, resultsResponse] =
      await Promise.all([
        fetch(
          `${API_BASE_URL}/evaluations/metrics`
        ),
        fetch(
          `${API_BASE_URL}/evaluations/results?limit=50`
        ),
      ]);

    if (
      !metricsResponse.ok ||
      !resultsResponse.ok
    ) {
      throw new Error(
        "Failed to load evaluation data."
      );
    }

    const metricsData =
      await metricsResponse.json();

    const resultsData =
      await resultsResponse.json();

    setEvaluationMetrics(metricsData);

    setEvaluationResults(
      resultsData.results ?? []
    );
  } catch (err) {
    console.error(err);

    setEvaluationsError(
      err instanceof Error
        ? err.message
        : "Could not load evaluation data."
    );
  } finally {
    setEvaluationsLoading(false);
  }
}
async function loadFailureDetails(
  evaluationId: string
) {
  setFailureDetailsLoading(true);
  setFailureDetailsError("");

  try {
    const response = await fetch(
      `${API_BASE_URL}/evaluations/results/${evaluationId}/failure-details`
    );

    if (!response.ok) {
      throw new Error(
        "Failed to load failure details."
      );
    }

    const data: EvaluationFailureDetails =
      await response.json();

    setSelectedFailureDetails(data);
  } catch (err) {
    console.error(err);

    setFailureDetailsError(
      err instanceof Error
        ? err.message
        : "Could not load failure details."
    );
  } finally {
    setFailureDetailsLoading(false);
  }
}
async function loadFailureExplorerTraces(
  runId: string
) {
  setFailureExplorerTracesLoading(true);
  setFailureExplorerTracesError("");

  try {
    const response = await fetch(
      `${API_BASE_URL}/agent/runs/${runId}/traces`
    );

    if (!response.ok) {
      throw new Error(
        "Failed to load execution trace."
      );
    }

    const data = await response.json();

    setFailureExplorerTraces(
      Array.isArray(data)
        ? data
        : data.traces ?? []
    );
  } catch (err) {
    console.error(
      "Failure Explorer trace load failed:",
      err
    );

    setFailureExplorerTraces([]);
    setFailureExplorerTracesError(
      err instanceof Error
        ? err.message
        : "Could not load execution trace."
    );
  } finally {
    setFailureExplorerTracesLoading(false);
  }
}
async function loadTestSuites() {
  setTestSuitesLoading(true);
  setTestSuitesError("");

  try {
    const response = await fetch(
      `${API_BASE_URL}/evaluations/test-suites`
    );

    if (!response.ok) {
      throw new Error(
        "Failed to load test suites."
      );
    }

    const data = await response.json();

    setTestSuites(
      Array.isArray(data)
        ? data
        : data.test_suites ?? []
    );
  } catch (err) {
    console.error(err);

    setTestSuitesError(
      err instanceof Error
        ? err.message
        : "Could not load test suites."
    );
  } finally {
    setTestSuitesLoading(false);
  }
}
async function loadTestSuiteRunHistory() {
  setSuiteRunHistoryLoading(true);
  setSuiteRunHistoryError("");

  try {
    const response = await fetch(
      `${API_BASE_URL}/evaluations/test-suite-runs`
    );

    if (!response.ok) {
      throw new Error(
        "Failed to load test suite run history."
      );
    }

    const data = await response.json();

    setSuiteRunHistory(
      Array.isArray(data)
        ? data
        : data.runs ?? []
    );
  } catch (err) {
    console.error(err);

    setSuiteRunHistoryError(
      err instanceof Error
        ? err.message
        : "Could not load test suite run history."
    );
  } finally {
    setSuiteRunHistoryLoading(false);
  }
}
async function loadTestSuiteRegression(
  suiteId: string
) {
  setSuiteRegressionLoading((current) => ({
    ...current,
    [suiteId]: true,
  }));

  try {
    const response = await fetch(
      `${API_BASE_URL}/evaluations/test-suites/${suiteId}/regression`
    );

    if (!response.ok) {
      throw new Error(
        "Failed to load regression status."
      );
    }

    const data: TestSuiteRegression =
      await response.json();

    setSuiteRegressions((current) => ({
      ...current,
      [suiteId]: data,
    }));
  } catch (err) {
    console.error(
      "Regression status load failed:",
      err
    );
  } finally {
    setSuiteRegressionLoading((current) => ({
      ...current,
      [suiteId]: false,
    }));
  }
}
async function loadTestCaseRegression(
  suiteId: string
) {
  setCaseRegressionLoading((current) => ({
    ...current,
    [suiteId]: true,
  }));

  try {
    const response = await fetch(
      `${API_BASE_URL}/evaluations/test-suites/${suiteId}/case-regression`
    );

    if (!response.ok) {
      throw new Error(
        "Failed to load case regression status."
      );
    }

    const data: TestCaseRegression =
      await response.json();

    setCaseRegressions((current) => ({
      ...current,
      [suiteId]: data,
    }));
  } catch (err) {
    console.error(
      "Case regression load failed:",
      err
    );
  } finally {
    setCaseRegressionLoading((current) => ({
      ...current,
      [suiteId]: false,
    }));
  }
}
async function generateAITests(
  suiteId: string
) {
  setTestGeneratorLoading(true);
  setTestGeneratorError("");
  setTestGeneratorMessage("");
  setGeneratedTests([]);
  setSelectedGeneratedTests([]);

  try {
    const availableTools =
      testGeneratorAvailableTools
        .split(",")
        .map((tool) => tool.trim())
        .filter(Boolean);

    const protectedTools =
      testGeneratorProtectedTools
        .split(",")
        .map((tool) => tool.trim())
        .filter(Boolean);

    const response = await fetch(
      `${API_BASE_URL}/evaluations/generate-tests`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agent_name: testGeneratorAgentName,
          agent_description:
            testGeneratorAgentDescription,
          available_tools: availableTools,
          protected_tools: protectedTools,
          number_of_tests: testGeneratorCount,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => null);

      throw new Error(
        errorData?.detail ??
          "Failed to generate AI tests."
      );
    }

    const data =
      (await response.json()) as GenerateTestsResponse;

    setGeneratedTests(
      data.generated_tests ?? []
    );

    setSelectedGeneratedTests(
      (data.generated_tests ?? []).map(
        (_, index) => index
      )
    );

    setTestGeneratorSuiteId(suiteId);

    setTestGeneratorMessage(
      `${data.total_tests} AI-generated tests are ready for review.`
    );
  } catch (err) {
    console.error(
      "AI test generation failed:",
      err
    );

    setTestGeneratorError(
      err instanceof Error
        ? err.message
        : "AI test generation failed."
    );
  } finally {
    setTestGeneratorLoading(false);
  }
}
async function saveSelectedGeneratedTests() {
  if (!testGeneratorSuiteId) {
    setTestGeneratorError(
      "No test suite is selected."
    );
    return;
  }

  const testsToSave =
    selectedGeneratedTests
      .map((index) => generatedTests[index])
      .filter(Boolean);

  if (testsToSave.length === 0) {
    setTestGeneratorError(
      "Select at least one generated test."
    );
    return;
  }

  setTestGeneratorSaving(true);
  setTestGeneratorError("");
  setTestGeneratorMessage("");

  try {
    const response = await fetch(
      `${API_BASE_URL}/evaluations/test-suites/${testGeneratorSuiteId}/generated-tests`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tests: testsToSave.map((test) => ({
            name: test.name,
            input_prompt: test.input_prompt,
            expected_tool: test.expected_tool,
            expected_approval_required:
              test.expected_approval_required,
            min_evaluation_score:
              test.min_evaluation_score,
            expected_response_contains:
              test.expected_response_contains,
          })),
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => null);

      throw new Error(
        errorData?.detail ??
          "Failed to save generated tests."
      );
    }

    const data = await response.json();

    setTestGeneratorMessage(
      `${data.saved_count} generated test${
        data.saved_count === 1 ? "" : "s"
      } added to the test suite.`
    );

    setGeneratedTests([]);
    setSelectedGeneratedTests([]);

    await loadTestSuites();
  } catch (err) {
    console.error(
      "Saving generated tests failed:",
      err
    );

    setTestGeneratorError(
      err instanceof Error
        ? err.message
        : "Could not save generated tests."
    );
  } finally {
    setTestGeneratorSaving(false);
  }
}
async function loadReliabilityScore(
  suiteId: string
) {
  setReliabilityScoreLoading(
    (current) => ({
      ...current,
      [suiteId]: true,
    })
  );

  try {
    const response = await fetch(
      `${API_BASE_URL}/evaluations/test-suites/${suiteId}/reliability-score`
    );

    if (!response.ok) {
      throw new Error(
        "Failed to load reliability score."
      );
    }

    const data =
      (await response.json()) as ReliabilityScore;

    setReliabilityScores(
      (current) => ({
        ...current,
        [suiteId]: data,
      })
    );
  } catch (err) {
    console.error(
      "Reliability score loading failed:",
      err
    );
  } finally {
    setReliabilityScoreLoading(
      (current) => ({
        ...current,
        [suiteId]: false,
      })
    );
  }
}
async function runTestSuite(
  suiteId: string
) {
  setRunningSuiteId(suiteId);
  setSuiteRunError("");

  try {
    const response = await fetch(
      `${API_BASE_URL}/evaluations/test-suites/${suiteId}/run`,
      {
        method: "POST",
      }
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => null);

      throw new Error(
        errorData?.detail ??
          "Failed to run test suite."
      );
    }

    const data =
      (await response.json()) as TestSuiteRunResult;

    setSuiteRunResults((current) => ({
      ...current,
      [suiteId]: data,
    }));

    await loadEvaluations();
    await loadTestSuiteRunHistory();
    await loadTestSuiteRegression(suiteId);
    await loadTestCaseRegression(suiteId);
    await loadReliabilityScore(suiteId);
  } catch (err) {
    console.error(err);

    setSuiteRunError(
      err instanceof Error
        ? err.message
        : "Test suite execution failed."
    );
  } finally {
    setRunningSuiteId(null);
  }
}
async function openRunDetails(run: AgentRun) {
  setSelectedRun(run);
  setTraces([]);
  setApprovalStatus(null);
  setApprovalMessage("");
  setApprovalTimeline([]);
  setTraceLoading(true);
  setApprovalTimelineLoading(
  Boolean(run.approval_required && run.approval_id)
);

  try {
    const requests = [
      fetch(
        `${API_BASE_URL}/agent/runs/${run.run_id}/traces`
      ),
    ];

if (run.approval_required && run.approval_id) {
  requests.push(
    fetch(
      `${API_BASE_URL}/approvals/${run.approval_id}`
    )
  );

  requests.push(
    fetch(
      `${API_BASE_URL}/approvals/${run.approval_id}/timeline`
    )
  );
}

    const responses = await Promise.all(requests);

    const traceResponse = responses[0];

    if (!traceResponse.ok) {
      throw new Error("Failed to load execution trace");
    }

    const traceData = await traceResponse.json();
    setTraces(traceData.traces ?? []);

if (
  run.approval_required &&
  run.approval_id
) {
  const approvalResponse = responses[1];
  const timelineResponse = responses[2];

  if (approvalResponse?.ok) {
    const approvalData =
      await approvalResponse.json();

    setApprovalStatus(
      approvalData.status ?? null
    );
  }

  if (timelineResponse?.ok) {
    const timelineData =
      await timelineResponse.json();

    setApprovalTimeline(
      timelineData.timeline ?? []
    );
  }
}
  } catch (err) {
    console.error(err);
    setTraces([]);
  } finally {
    setTraceLoading(false);
    setApprovalTimelineLoading(false);
  }
}
async function handleApprovalDecision(
  decision: "approve" | "reject"
) {
  if (!selectedRun?.approval_id) {
    return;
  }

  setApprovalActionLoading(true);
  setApprovalMessage("");

  try {
    const response = await fetch(
      `${API_BASE_URL}/approvals/${selectedRun.approval_id}/${decision}`,
      {
        method: "POST",
      }
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => null);

      throw new Error(
        errorData?.detail ??
          `Failed to ${decision} request`
      );
    }

    const data = await response.json();

    setApprovalStatus(
      data.status ??
        (decision === "approve"
          ? "approved"
          : "rejected")
    );

    setApprovalMessage(
      decision === "approve"
        ? "Approval granted. The protected action is now authorized for execution."
        : "Approval rejected. The protected action will not be executed."
    );
  } catch (err) {
    console.error(err);

    setApprovalMessage(
      err instanceof Error
        ? err.message
        : "Approval action failed."
    );
  } finally {
    setApprovalActionLoading(false);
  }
}
async function handleApprovedExecution() {
  if (!selectedRun?.approval_id) {
    return;
  }

  setApprovalActionLoading(true);
  setApprovalMessage("");

  try {
    const response = await fetch(
      `${API_BASE_URL}/approvals/${selectedRun.approval_id}/execute`,
      {
        method: "POST",
      }
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => null);

      throw new Error(
        typeof errorData?.detail === "string"
          ? errorData.detail
          : "Failed to execute approved action."
      );
    }

    const data = await response.json();

    setApprovalStatus(
      data.approval_status ?? "executed"
    );

    setApprovalMessage(
      "Approved action executed successfully and recorded in the audit trail."
    );
  } catch (err) {
    console.error(err);

    setApprovalMessage(
      err instanceof Error
        ? err.message
        : "Approved action execution failed."
    );
  } finally {
    setApprovalActionLoading(false);
  }
}
async function loadApprovals() {
  setApprovalsLoading(true);
  setApprovalsError("");

  try {
    const response = await fetch(
      `${API_BASE_URL}/approvals?limit=100`
    );

    if (!response.ok) {
      throw new Error(
        "Failed to load approval requests."
      );
    }

    const data = await response.json();

    setApprovals(data.approvals ?? []);
  } catch (err) {
    console.error(err);

    setApprovalsError(
      err instanceof Error
        ? err.message
        : "Could not load approval requests."
    );
  } finally {
    setApprovalsLoading(false);
  }
}
const filteredApprovals =
  approvalFilter === "all"
    ? approvals
    : approvals.filter(
        (approval) => approval.status === approvalFilter
      );
async function openApprovalDetails(
  approval: ApprovalRequest
) {
  setSelectedApproval(approval);
  setSelectedApprovalTimeline([]);
  setSelectedApprovalMessage("");
  setSelectedApprovalLoading(true);

  try {
    const [approvalResponse, timelineResponse] =
      await Promise.all([
        fetch(
          `${API_BASE_URL}/approvals/${approval.approval_id}`
        ),
        fetch(
          `${API_BASE_URL}/approvals/${approval.approval_id}/timeline`
        ),
      ]);

    if (!approvalResponse.ok) {
      throw new Error(
        "Failed to load approval details."
      );
    }

    const approvalData =
      await approvalResponse.json();

    setSelectedApproval(approvalData);

    if (timelineResponse.ok) {
      const timelineData =
        await timelineResponse.json();

      setSelectedApprovalTimeline(
        timelineData.timeline ?? []
      );
    }
  } catch (err) {
    console.error(err);

    setSelectedApprovalMessage(
      err instanceof Error
        ? err.message
        : "Could not load approval details."
    );
  } finally {
    setSelectedApprovalLoading(false);
  }
}
async function refreshSelectedApproval(
  approvalId: string
) {
  try {
    const [approvalResponse, timelineResponse] =
      await Promise.all([
        fetch(
          `${API_BASE_URL}/approvals/${approvalId}`
        ),
        fetch(
          `${API_BASE_URL}/approvals/${approvalId}/timeline`
        ),
      ]);

    if (approvalResponse.ok) {
      const approvalData =
        await approvalResponse.json();

      setSelectedApproval(approvalData);
    }

    if (timelineResponse.ok) {
      const timelineData =
        await timelineResponse.json();

      setSelectedApprovalTimeline(
        timelineData.timeline ?? []
      );
    }

    await loadApprovals();
  } catch (err) {
    console.error(err);
  }
}
async function handleSelectedApprovalAction(
  action: "approve" | "reject" | "execute"
) {
  if (!selectedApproval) {
    return;
  }

  setSelectedApprovalLoading(true);
  setSelectedApprovalMessage("");

  try {
    const response = await fetch(
      `${API_BASE_URL}/approvals/${selectedApproval.approval_id}/${action}`,
      {
        method: "POST",
      }
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => null);

      throw new Error(
        typeof errorData?.detail === "string"
          ? errorData.detail
          : `Failed to ${action} approval request.`
      );
    }

    if (action === "approve") {
      setSelectedApprovalMessage(
        "Approval granted. The protected action is now authorized for execution."
      );
    }

    if (action === "reject") {
      setSelectedApprovalMessage(
        "Approval rejected. The protected action is blocked."
      );
    }

    if (action === "execute") {
      setSelectedApprovalMessage(
        "Approved action executed successfully and recorded in the audit trail."
      );
    }

    await refreshSelectedApproval(
      selectedApproval.approval_id
    );
  } catch (err) {
    console.error(err);

    setSelectedApprovalMessage(
      err instanceof Error
        ? err.message
        : "Approval action failed."
    );
  } finally {
    setSelectedApprovalLoading(false);
  }
}
async function handleLogin(
  event: React.FormEvent<HTMLFormElement>
) {
  event.preventDefault();

  setLoginLoading(true);
  setLoginError("");

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        password,
      }),
    });

    if (!response.ok) {
      throw new Error("Invalid password.");
    }

    setAuthenticated(true);
    setPassword("");
  } catch (err) {
    setLoginError(
      err instanceof Error
        ? err.message
        : "Login failed."
    );
  } finally {
    setLoginLoading(false);
  }
}

async function handleLogout() {
  await fetch("/api/logout", {
    method: "POST",
  });

  setAuthenticated(false);
  setPassword("");
}

if (!authenticated) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F7FA] px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 font-semibold text-white">
            AI
          </div>

          <h1 className="text-2xl font-semibold text-slate-900">
            Enterprise AI Platform
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Authorized access only
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Access password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              autoComplete="current-password"
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500"
              placeholder="Enter password"
            />
          </div>

          {loginError && (
            <p className="text-sm text-red-600">
              {loginError}
            </p>
          )}

          <button
            type="submit"
            disabled={loginLoading}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loginLoading
              ? "Signing in..."
              : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
return (
    <main className="min-h-screen bg-[#F5F7FA] text-slate-900">
      <div className="flex min-h-screen">

  {/* Sidebar */}
  <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
    <div className="border-b border-slate-200 px-6 py-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white">
          AI
        </div>

        <div>
          <p className="font-semibold text-slate-900">
            Enterprise AI
          </p>
          <p className="text-xs text-slate-500">
            Control Platform
          </p>
        </div>
      </div>
    </div>

    <nav className="flex-1 px-4 py-6">
      <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">
        Operations
      </p>

      <div className="mt-3 space-y-1">
<button
  type="button"
  onClick={() => setActiveView("overview")}
  className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
    activeView === "overview"
      ? "bg-slate-100 font-medium text-slate-900"
      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
  }`}
>
  Overview
</button>

<button
  type="button"
  onClick={() => setActiveView("agent-runs")}
  className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
    activeView === "agent-runs"
      ? "bg-slate-100 font-medium text-slate-900"
      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
  }`}
>
  Agent Runs
</button>

<button
  type="button"
  onClick={() => {setActiveView("approvals");
  loadApprovals();}}
  className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
    activeView === "approvals"
      ? "bg-slate-100 font-medium text-slate-900"
      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
  }`}
>
  Approvals
</button>

<button
  type="button"
  onClick={() => {
    setActiveView("evaluations");
    loadEvaluations();
  }}
  className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
    activeView === "evaluations"
      ? "bg-slate-100 font-medium text-slate-900"
      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
  }`}
>
  Evaluations
</button>
<button
  type="button"
  onClick={() => {
    setActiveView("test-suites");
    loadTestSuites();
    loadTestSuiteRunHistory();
    loadReliabilityScore(
    "903240a3-0cbd-4a54-986e-cfceff0aaba8"
    );

    testSuites.forEach((suite) => {
      loadTestSuiteRegression(suite.suite_id);
      loadTestCaseRegression(suite.suite_id);
    })
  }}
  className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
    activeView === "test-suites"
      ? "bg-slate-100 font-medium text-slate-900"
      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
  }`}
>
  Test Suites
</button>
      </div>

      <p className="mt-8 px-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">
        Platform
      </p>

      <div className="mt-3 space-y-1">
        <div className="px-3 py-2.5 text-sm text-slate-500">
          Agents
        </div>

        <div className="px-3 py-2.5 text-sm text-slate-500">
          Tools & MCP
        </div>

        <div className="px-3 py-2.5 text-sm text-slate-500">
          Audit Trail
        </div>

        <div className="px-3 py-2.5 text-sm text-slate-500">
          Settings
        </div>
      </div>
    </nav>

    <div className="border-t border-slate-200 p-4">
      <div className="rounded-xl bg-emerald-50 p-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />

          <span className="text-xs font-medium text-emerald-800">
            Platform Operational
          </span>
        </div>

        <p className="mt-1 text-xs text-emerald-700/70">
          Runtime connected
        </p>
      </div>
    </div>
  </aside>

  {/* Main workspace */}
  <div className="min-w-0 flex-1">

    {/* Top bar */}
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 lg:px-8">
      <div>
        <p className="text-sm font-medium text-slate-700">
          Enterprise AI Runtime
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 sm:flex">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          API Connected
        </div>

        <div className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">
          Production
        </div>
          <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Logout
        </button>
      </div>
    </header>

    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
<div className="mb-10">
  <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
    Enterprise AI Runtime & Control Platform
  </p>

<h1 className="mt-2 text-4xl font-semibold">
  {activeView === "overview"
    ? "AI Control Center"
    : activeView === "agent-runs"
    ? "Agent Runs"
    : activeView === "approvals"
      ? "Approval Operations"
      : activeView === "evaluations"
        ? "Evaluations"
        : "Test Suites"}
</h1>

<p className="mt-3 text-slate-400">
  {activeView === "overview"
    ? "Operational visibility across enterprise AI agents."
    : activeView === "agent-runs"
    ? "Inspect enterprise AI agent executions, tools, quality, latency, and approval activity."
    : activeView === "approvals"
      ? "Review, govern, and track protected AI actions requiring human authorization."
      : activeView === "evaluations"
        ? "Measure agent quality, policy behavior, tool selection, and production readiness."
        : "Define and execute repeatable production-readiness tests for enterprise AI agents."}
</p>
</div>

        {loading && (
          <p className="text-slate-400">
            Loading operational data...
          </p>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            {error}
          </div>
        )}

        {(activeView === "overview" || activeView === "agent-runs") && metrics && (
          <>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              <MetricCard
                title="Total Runs"
                value={metrics.total_runs}
                subtitle="Recorded agent executions"
              />

              <MetricCard
                title="Success Rate"
                value={`${metrics.success_rate_percent}%`}
                subtitle={`${metrics.completed_runs} completed runs`}
              />

              <MetricCard
                title="Average Quality"
                value={metrics.average_evaluation_score}
                subtitle="Evaluator score"
              />

              <MetricCard
                title="Average Latency"
                value={`${(
                  metrics.average_latency_ms / 1000
                ).toFixed(2)}s`}
                subtitle="End-to-end execution time"
              />

              <MetricCard
                title="Tool Usage"
                value={`${metrics.tool_usage_rate_percent}%`}
                subtitle={`${metrics.tool_runs} tool-enabled runs`}
              />

              <MetricCard
                title="Human Approval"
                value={`${metrics.approval_rate_percent}%`}
                subtitle={`${metrics.approval_required_runs} approval-required runs`}
              />
            </div>

            <section className="mt-10">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <h2 className="text-xl font-semibold">
                    Recent Agent Runs
                  </h2>

                  <p className="mt-1 text-sm text-slate-400">
                    Latest execution activity across the AI runtime.
                  </p>
                </div>

                <span className="text-sm text-slate-500">
                  Showing {runs.length} runs
                </span>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1050px] text-left">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr className="text-xs uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-4 font-medium">
                          Task
                        </th>
                        <th className="px-5 py-4 font-medium">
                          Status
                        </th>
                        <th className="px-5 py-4 font-medium">
                          Model
                        </th>
                        <th className="px-5 py-4 font-medium">
                          Tool
                        </th>
                        <th className="px-5 py-4 font-medium">
                          Score
                        </th>
                        <th className="px-5 py-4 font-medium">
                          Latency
                        </th>
                        <th className="px-5 py-4 font-medium">
                          Approval
                        </th>
                        <th className="px-5 py-4 font-medium">
                          Started
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {runs.map((run) => (
                        <tr
                          key={run.run_id}
                          onClick={() => openRunDetails(run)}
                          className="cursor-pointer text-sm transition hover:bg-slate-50"
                        >
                          <td className="max-w-[330px] px-5 py-4">
                            <p
                              className="truncate font-medium text-slate-800"
                              title={run.task}
                            >
                              {run.task}
                            </p>

                            <p className="mt-1 font-mono text-xs text-slate-600">
                              {run.run_id.slice(0, 8)}
                            </p>
                          </td>

                          <td className="px-5 py-4">
                            <StatusBadge status={run.status} />
                          </td>

                          <td className="px-5 py-4 text-slate-400">
                            {run.model ?? "-"}
                          </td>

                          <td className="px-5 py-4">
                            {run.selected_tool ? (
                              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-700">
                                {run.selected_tool}
                              </span>
                            ) : (
                              <span className="text-slate-600">
                                None
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4 font-medium text-slate-700">
                            {run.evaluation_score ?? "-"}
                          </td>

                          <td className="px-5 py-4 text-slate-400">
                            {run.latency_ms !== null
                              ? `${(
                                  run.latency_ms / 1000
                                ).toFixed(2)}s`
                              : "-"}
                          </td>

                          <td className="px-5 py-4">
                            {run.approval_required ? (
                              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                                Required
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500">
                                Not required
                              </span>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                            {formatDate(run.started_at)}
                          </td>
                        </tr>
                      ))}

                      {runs.length === 0 && (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-5 py-12 text-center text-slate-500"
                          >
                            No agent runs recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {selectedRun && (
              <section className="mt-10">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Run Details
                    </p>

                    <h2 className="mt-1 text-xl font-semibold text-slate-900">
                      Execution Trace
                    </h2>

                    <p className="mt-1 max-w-3xl text-sm text-slate-500">
                      {selectedRun.task}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRun(null);
                      setTraces([]);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                  {/* Run summary */}
                  <div className="grid gap-4 border-b border-slate-100 pb-6 sm:grid-cols-2 lg:grid-cols-4">
                    <TraceSummary
                      label="Run ID"
                      value={selectedRun.run_id.slice(0, 8)}
                    />

                    <TraceSummary
                      label="Status"
                      value={selectedRun.status}
                    />

                    <TraceSummary
                      label="Quality"
                      value={
                        selectedRun.evaluation_score !== null
                          ? `${selectedRun.evaluation_score}/100`
                          : "-"
                      }
                    />

                    <TraceSummary
                      label="Total Latency"
                      value={
                        selectedRun.latency_ms !== null
                          ? `${(
                              selectedRun.latency_ms / 1000
                            ).toFixed(2)}s`
                          : "-"
                      }
                    />
                  </div>
{selectedRun.approval_required && (
  <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

      {/* LEFT SIDE */}
      <div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />

          <p className="font-semibold text-amber-900">
  {approvalStatus === "executed"
    ? "Protected Action Executed"
    : approvalStatus === "approved"
      ? "Protected Action Approved"
      : approvalStatus === "rejected"
        ? "Protected Action Rejected"
        : "Human Approval Required"}
</p>
        </div>

<p className="mt-2 text-sm text-amber-800">
  {approvalStatus === "executed"
    ? "The protected enterprise action was approved, executed successfully, and recorded in the audit trail."
    : approvalStatus === "approved"
      ? "An authorized human approved this protected enterprise action. It is authorized and ready for execution."
      : approvalStatus === "rejected"
        ? "An authorized human rejected this protected enterprise action. Execution is blocked."
        : "The AI agent requested a protected enterprise action. Execution is paused until an authorized human approves or rejects the request."}
</p>

        <div className="mt-4 flex flex-wrap gap-3">
          <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">
              Requested Tool
            </p>

            <p className="mt-1 font-mono text-xs font-medium text-slate-800">
              {selectedRun.selected_tool ?? "-"}
            </p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">
              Approval ID
            </p>

            <p
              className="mt-1 max-w-[260px] truncate font-mono text-xs font-medium text-slate-800"
              title={selectedRun.approval_id ?? ""}
            >
              {selectedRun.approval_id ?? "-"}
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - BUTTONS */}
      <div className="flex min-w-[190px] flex-col gap-2">
        {!approvalStatus && (
          <>
            <button
              type="button"
              disabled={approvalActionLoading}
              onClick={() =>
                handleApprovalDecision("approve")
              }
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {approvalActionLoading
                ? "Processing..."
                : "Approve"}
            </button>

            <button
              type="button"
              disabled={approvalActionLoading}
              onClick={() =>
                handleApprovalDecision("reject")
              }
              className="rounded-lg border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}

{approvalStatus === "approved" && (
  <>
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700">
      Approved
    </div>

    <button
      type="button"
      disabled={approvalActionLoading}
      onClick={handleApprovedExecution}
      className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {approvalActionLoading
        ? "Executing..."
        : "Execute Approved Action"}
    </button>
  </>
)}
{approvalStatus === "executed" && (
  <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-center text-sm font-semibold text-blue-700">
    Executed
  </div>
)}

        {approvalStatus === "rejected" && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700">
            Rejected
          </div>
        )}
      </div>
    </div>

    {/* APPROVAL RESULT MESSAGE */}
    {approvalMessage && (
      <div className="mt-4 border-t border-amber-200 pt-4 text-sm text-slate-700">
        {approvalMessage}
      </div>
    )}
{/* APPROVAL TIMELINE */}
<div className="mt-5 border-t border-amber-200 pt-5">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-semibold text-slate-900">
        Approval Timeline
      </p>

      <p className="mt-1 text-xs text-slate-500">
        Governance and execution history for this protected action.
      </p>
    </div>

    {!approvalTimelineLoading && (
      <span className="text-xs text-slate-500">
        {approvalTimeline.length} events
      </span>
    )}
  </div>

  {approvalTimelineLoading && (
    <p className="mt-4 text-sm text-slate-500">
      Loading approval history...
    </p>
  )}

  {!approvalTimelineLoading &&
    approvalTimeline.length === 0 && (
      <div className="mt-4 rounded-lg border border-amber-200 bg-white px-4 py-3 text-sm text-slate-500">
        No approval audit events are available.
      </div>
    )}

  {!approvalTimelineLoading &&
    approvalTimeline.length > 0 && (
      <div className="mt-5 space-y-0">
        {approvalTimeline.map((event, index) => (
          <div
            key={
              event.id ??
              `${event.event_type}-${event.created_at}-${index}`
            }
            className="relative flex gap-3"
          >
            {/* Timeline marker */}
            <div className="flex w-5 flex-col items-center">
              <div className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-700 ring-4 ring-white" />

              {index < approvalTimeline.length - 1 && (
                <div className="my-1 w-px flex-1 bg-amber-200" />
              )}
            </div>

            {/* Event */}
            <div className="mb-4 flex-1 rounded-lg border border-amber-200 bg-white px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {formatNodeName(event.event_type)}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {event.tool_name ?? selectedRun.selected_tool ?? "Protected action"}
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {formatNodeName(event.status)}
                </span>
              </div>

              {event.created_at && (
                <p className="mt-3 text-xs text-slate-400">
                  {formatDate(event.created_at)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    )}
   </div>
  </div>
)}
                  {/* Trace timeline */}
                  <div className="mt-7">
                    <div className="mb-5 flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900">
                        Agent Execution Path
                      </h3>

                      <span className="text-xs text-slate-500">
                        {traces.length} trace events
                      </span>
                    </div>

                    {traceLoading && (
                      <p className="text-sm text-slate-500">
                        Loading execution trace...
                      </p>
                    )}

                    {!traceLoading && traces.length === 0 && (
                      <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                        No execution trace is available for this run.
                      </div>
                    )}

                    {!traceLoading && traces.length > 0 && (
                      <div className="space-y-0">
                        {traces.map((trace, index) => (
                          <div
                            key={trace.id}
                            className="relative flex gap-4"
                          >
                            {/* Timeline */}
                            <div className="flex w-6 flex-col items-center">
                              <div
                                className={`mt-1 h-3 w-3 rounded-full ring-4 ${
                                  trace.status === "completed"
                                    ? "bg-emerald-500 ring-emerald-50"
                                    : "bg-red-500 ring-red-50"
                                }`}
                              />

                              {index < traces.length - 1 && (
                                <div className="my-1 w-px flex-1 bg-slate-200" />
                              )}
                            </div>

                            {/* Event */}
                            <div className="mb-6 flex-1 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold capitalize text-slate-800">
                                    {formatNodeName(trace.node_name)}
                                  </p>

                                  <p className="mt-1 text-xs text-slate-500">
                                    {trace.event_type}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  <StatusBadge
                                    status={trace.status}
                                  />

                                  <span className="rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
                                    {trace.duration_ms !== null
                                      ? `${(
                                          trace.duration_ms /
                                          1000
                                        ).toFixed(2)}s`
                                      : "-"}
                                  </span>
                                </div>
                              </div>

                              {Object.keys(trace.details ?? {}).length >
                                0 && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                  {Object.entries(
                                    trace.details
                                  ).map(([key, value]) => (
                                    <TraceDetail
                                      key={key}
                                      label={formatNodeName(key)}
                                      value={formatTraceValue(value)}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}
{failureDetailsLoading && (
  <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
    Loading failure diagnostics...
  </div>
)}

{failureDetailsError && (
  <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
    {failureDetailsError}
  </div>
)}

{selectedFailureDetails && (
  <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Failure Explorer
        </p>

        <h4 className="mt-1 text-lg font-semibold text-slate-900">
          {selectedFailureDetails.test_name}
        </h4>

        {selectedFailureDetails.input_prompt && (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            {selectedFailureDetails.input_prompt}
          </p>
        )}
      </div>

      <StatusBadge
        status={selectedFailureDetails.status}
      />
    </div>

    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Selected Tool
        </p>

        <p className="mt-1 break-all font-mono text-sm font-medium text-slate-800">
          {selectedFailureDetails.actual_tool ?? "None"}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Approval Required
        </p>

        <p className="mt-1 text-sm font-semibold text-slate-800">
          {selectedFailureDetails.actual_approval_required
            ? "Yes"
            : "No"}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Evaluation Score
        </p>

        <p className="mt-1 text-sm font-semibold text-slate-800">
          {selectedFailureDetails.evaluation_score !== null
            ? `${selectedFailureDetails.evaluation_score}/100`
            : "-"}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Result
        </p>

        <p
          className={`mt-1 text-sm font-semibold ${
            selectedFailureDetails.passed
              ? "text-emerald-700"
              : "text-red-600"
          }`}
        >
          {selectedFailureDetails.passed
            ? "PASS"
            : "FAIL"}
        </p>
      </div>
    </div>

    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h5 className="font-semibold text-slate-900">
            Diagnostic Checks
          </h5>

          <p className="mt-1 text-sm text-slate-500">
            Expected behavior compared with the actual
            agent execution.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {selectedFailureDetails.checks.map(
          (check, index) => (
            <div
              key={`${check.check}-${index}`}
              className={`rounded-xl border p-4 ${
                check.passed
                  ? "border-emerald-200 bg-emerald-50/50"
                  : "border-red-200 bg-red-50/50"
              }`}
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <p className="font-medium text-slate-800">
                    {check.check
                      .replaceAll("_", " ")
                      .replace(/\b\w/g, (char) =>
                        char.toUpperCase()
                      )}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-600">
                    <span>
                      Expected:{" "}
                      <strong className="font-medium text-slate-800">
                        {String(check.expected)}
                      </strong>
                    </span>

                    <span>
                      Actual:{" "}
                      <strong className="font-medium text-slate-800">
                        {String(check.actual)}
                      </strong>
                    </span>
                  </div>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
                    check.passed
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : "bg-red-50 text-red-700 ring-red-200"
                  }`}
                >
                  {check.passed ? "PASSED" : "FAILED"}
                </span>
              </div>
            </div>
          )
        )}
      </div>
    </div>

    <div className="mt-6 border-t border-slate-200 pt-5">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Failed Checks
          </p>

          <p className="mt-2 text-sm text-slate-700">
            {selectedFailureDetails.failed_checks.length > 0
              ? selectedFailureDetails.failed_checks.join(", ")
              : "None"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Agent Run ID
          </p>

          <p
            className="mt-2 break-all font-mono text-xs text-slate-600"
            title={selectedFailureDetails.run_id}
          >
            {selectedFailureDetails.run_id}
          </p>
        </div>
      </div>
    </div>
  </div>
)}
          </>
        )}
{activeView === "evaluations" && (
  <section>
    <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Evaluation Performance
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Production-readiness results from persisted agent evaluations.
        </p>
      </div>

      <button
        type="button"
        onClick={loadEvaluations}
        disabled={evaluationsLoading}
        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
      >
        {evaluationsLoading
          ? "Refreshing..."
          : "Refresh"}
      </button>
    </div>

    {evaluationsError && (
      <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {evaluationsError}
      </div>
    )}

    {evaluationsLoading && (
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
        Loading evaluation data...
      </div>
    )}

    {!evaluationsLoading && evaluationMetrics && (
      <>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Total Evaluations"
            value={evaluationMetrics.total_evaluations}
            subtitle="Persisted evaluation executions"
          />

          <MetricCard
            title="Pass Rate"
            value={`${evaluationMetrics.pass_rate}%`}
            subtitle={`${evaluationMetrics.passed} passed`}
          />

          <MetricCard
            title="Average Score"
            value={
              evaluationMetrics.average_evaluation_score !== null
                ? evaluationMetrics.average_evaluation_score
                : "-"
            }
            subtitle="Average evaluator quality score"
          />

          <MetricCard
            title="Failed Evaluations"
            value={evaluationMetrics.failed}
            subtitle="Tests requiring investigation"
          />
        </div>

        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Recent Evaluation History
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Latest production-readiness tests executed against the AI runtime.
              </p>
            </div>

            <span className="text-sm text-slate-500">
              Showing {evaluationResults.length} evaluations
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr className="text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-4 font-medium">
                      Status
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Tool
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Score
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Approval
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Failed Checks
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Run ID
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Created
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {evaluationResults.map((evaluation) => (
                    <tr
                      key={evaluation.evaluation_id}
onClick={() => {
  setSelectedEvaluation(evaluation);

if (evaluation.evaluation_id) {
  loadFailureDetails(
    evaluation.evaluation_id
  );
}

if (evaluation.run_id) {
  loadFailureExplorerTraces(
    evaluation.run_id
  );
}
}}
                        className="cursor-pointer text-sm transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <StatusBadge
                          status={evaluation.status}
                        />
                      </td>

                      <td className="px-5 py-4">
                        {evaluation.actual_tool ? (
                          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-700">
                            {evaluation.actual_tool}
                          </span>
                        ) : (
                          <span className="text-slate-500">
                            None
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 font-medium text-slate-700">
                        {evaluation.evaluation_score !== null
                          ? `${evaluation.evaluation_score}/100`
                          : "-"}
                      </td>

                      <td className="px-5 py-4">
                        {evaluation.actual_approval_required ? (
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                            Required
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">
                            Not required
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {evaluation.failed_checks.length > 0 ? (
                          <span className="text-sm font-medium text-red-600">
                            {evaluation.failed_checks.length}
                          </span>
                        ) : (
                          <span className="text-sm text-emerald-600">
                            None
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className="font-mono text-xs text-slate-600"
                          title={evaluation.run_id}
                        >
                          {evaluation.run_id.slice(0, 8)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                        {formatDate(
                          evaluation.created_at
                        )}
                      </td>
                    </tr>
                  ))}

                  {evaluationResults.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-12 text-center text-slate-500"
                      >
                        No evaluation results recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        {selectedEvaluation && (
  <section className="mt-10">
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Evaluation Review
        </p>

        <h2 className="mt-1 text-xl font-semibold text-slate-900">
          Expected vs Actual
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Detailed validation checks for this agent evaluation.
        </p>
      </div>

      <button
        type="button"
        onClick={() =>
          setSelectedEvaluation(null)
        }
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
      >
        Close
      </button>
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-4 border-b border-slate-100 pb-6 sm:grid-cols-2 lg:grid-cols-4">
        <TraceSummary
          label="Status"
          value={selectedEvaluation.status}
        />

        <TraceSummary
          label="Score"
          value={
            selectedEvaluation.evaluation_score !== null
              ? `${selectedEvaluation.evaluation_score}/100`
              : "-"
          }
        />

        <TraceSummary
          label="Tool"
          value={
            selectedEvaluation.actual_tool ??
            "None"
          }
        />

        <TraceSummary
          label="Approval Required"
          value={
            selectedEvaluation.actual_approval_required
              ? "Yes"
              : "No"
          }
        />
      </div>

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Evaluation ID
        </p>

        <p className="mt-2 break-all font-mono text-sm text-slate-700">
          {selectedEvaluation.evaluation_id}
        </p>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Run ID
        </p>

        <p className="mt-2 break-all font-mono text-sm text-slate-700">
          {selectedEvaluation.run_id}
        </p>
      </div>

      <div className="mt-7 border-t border-slate-100 pt-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">
              Validation Checks
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Comparison of expected behavior against actual agent behavior.
            </p>
          </div>

          <span className="text-xs text-slate-500">
            {selectedEvaluation.checks.length} checks
          </span>
        </div>

        <div className="space-y-3">
          {selectedEvaluation.checks.map(
            (check, index) => (
              <div
                key={`${check.check}-${index}`}
                className={`rounded-xl border p-4 ${
                  check.passed
                    ? "border-emerald-200 bg-emerald-50/60"
                    : "border-red-200 bg-red-50/60"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800">
                      {formatNodeName(
                        check.check
                      )}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Production-readiness validation
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      check.passed
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {check.passed
                      ? "Passed"
                      : "Failed"}
                  </span>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Expected
                    </p>

                    <p className="mt-1 break-words text-sm font-medium text-slate-700">
                      {formatTraceValue(
                        check.expected
                      )}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Actual
                    </p>

                    <p className="mt-1 break-words text-sm font-medium text-slate-700">
                      {formatTraceValue(
                        check.actual
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {failureDetailsLoading && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          Loading failure diagnostics...
        </div>
      )}

      {failureDetailsError && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {failureDetailsError}
        </div>
      )}

      {selectedFailureDetails && (
        <div className="mt-7 border-t border-slate-200 pt-6">
          <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Failure Explorer
              </p>

              <h3 className="mt-1 text-lg font-semibold text-slate-900">
                {selectedFailureDetails.test_name}
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Diagnostic view of the agent execution and
                production-readiness checks.
              </p>
            </div>

            <StatusBadge
              status={selectedFailureDetails.status}
            />
          </div>

          {selectedFailureDetails.input_prompt && (
            <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Test Prompt
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-700">
                {selectedFailureDetails.input_prompt}
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TraceSummary
              label="Tool"
              value={
                selectedFailureDetails.actual_tool ??
                "None"
              }
            />

            <TraceSummary
              label="Approval"
              value={
                selectedFailureDetails
                  .actual_approval_required
                  ? "Required"
                  : "Not Required"
              }
            />

            <TraceSummary
              label="Score"
              value={
                selectedFailureDetails
                  .evaluation_score !== null
                  ? `${selectedFailureDetails.evaluation_score}/100`
                  : "-"
              }
            />

            <TraceSummary
              label="Failed Checks"
              value={
                selectedFailureDetails
                  .failed_checks.length
              }
            />
          </div>

{selectedFailureDetails.evaluation_feedback && (
  <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
      Evaluator Feedback
    </p>

    <h4 className="mt-1 font-semibold text-slate-900">
      Why the agent received this score
    </h4>

    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
      {selectedFailureDetails.evaluation_feedback}
    </p>
  </div>
)}

<div className="mt-6">
  <h4 className="font-semibold text-slate-900">
    Diagnostic Checks
  </h4>

            <p className="mt-1 text-sm text-slate-500">
              Why this execution passed or failed its
              defined production-readiness expectations.
            </p>

            <div className="mt-4 space-y-3">
              {selectedFailureDetails.checks.map(
                (check, index) => (
                  <div
                    key={`${check.check}-${index}`}
                    className={`rounded-xl border p-4 ${
                      check.passed
                        ? "border-emerald-200 bg-emerald-50/60"
                        : "border-red-200 bg-red-50/60"
                    }`}
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <p className="font-semibold text-slate-800">
                          {formatNodeName(
                            check.check
                          )}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-600">
                          <span>
                            Expected:{" "}
                            <strong className="font-medium text-slate-800">
                              {formatTraceValue(
                                check.expected
                              )}
                            </strong>
                          </span>

                          <span>
                            Actual:{" "}
                            <strong className="font-medium text-slate-800">
                              {formatTraceValue(
                                check.actual
                              )}
                            </strong>
                          </span>
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          check.passed
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {check.passed
                          ? "PASSED"
                          : "FAILED"}
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-3 border-t border-slate-200 pt-5 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Failed Checks
              </p>

              <p className="mt-2 text-sm text-slate-700">
                {selectedFailureDetails
                  .failed_checks.length > 0
                  ? selectedFailureDetails.failed_checks.join(
                      ", "
                    )
                  : "None"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Agent Run ID
              </p>

              <p
                className="mt-2 break-all font-mono text-xs text-slate-600"
                title={
                  selectedFailureDetails.run_id
                }
              >
                {selectedFailureDetails.run_id}
              </p>
            </div>
          </div>

          {/* Execution Trace */}
          <div className="mt-7 border-t border-slate-200 pt-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Execution Trace
                </p>

                <h4 className="mt-1 text-lg font-semibold text-slate-900">
                  Agent Processing Path
                </h4>

                <p className="mt-1 text-sm text-slate-500">
                  Step-by-step execution path for this agent run.
                </p>
              </div>

              {!failureExplorerTracesLoading && (
                <span className="text-xs text-slate-500">
                  {failureExplorerTraces.length} trace events
                </span>
              )}
            </div>

            {failureExplorerTracesLoading && (
              <p className="mt-5 text-sm text-slate-500">
                Loading execution trace...
              </p>
            )}

            {failureExplorerTracesError && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {failureExplorerTracesError}
              </div>
            )}

            {!failureExplorerTracesLoading &&
              !failureExplorerTracesError &&
              failureExplorerTraces.length === 0 && (
                <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  No execution trace is available for this run.
                </div>
              )}

            {!failureExplorerTracesLoading &&
              !failureExplorerTracesError &&
              failureExplorerTraces.length > 0 && (
                <div className="mt-6 space-y-0">
                  {failureExplorerTraces.map(
                    (trace, index) => (
                      <div
                        key={trace.id}
                        className="relative flex gap-4"
                      >
                        <div className="flex w-6 flex-col items-center">
                          <div
                            className={`mt-1 h-3 w-3 rounded-full ring-4 ${
                              trace.status === "completed"
                                ? "bg-emerald-500 ring-emerald-50"
                                : "bg-red-500 ring-red-50"
                            }`}
                          />

                          {index <
                            failureExplorerTraces.length - 1 && (
                            <div className="my-1 w-px flex-1 bg-slate-200" />
                          )}
                        </div>

                        <div className="mb-5 flex-1 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-800">
                                {formatNodeName(
                                  trace.node_name
                                )}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {formatNodeName(
                                  trace.event_type
                                )}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <StatusBadge
                                status={trace.status}
                              />

                              <span className="rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
                                {trace.duration_ms !== null
                                  ? `${(
                                      trace.duration_ms /
                                      1000
                                    ).toFixed(2)}s`
                                  : "-"}
                              </span>
                            </div>
                          </div>

                          {trace.details &&
                            Object.keys(
                              trace.details
                            ).length > 0 && (
                              <div className="mt-4 flex flex-wrap gap-2">
                                {Object.entries(
                                  trace.details
                                ).map(
                                  ([key, value]) => (
                                    <TraceDetail
                                      key={key}
                                      label={formatNodeName(
                                        key
                                      )}
                                      value={formatTraceValue(
                                        value
                                      )}
                                    />
                                  )
                                )}
                              </div>
                            )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  </section>
)}
      </>
    )}
  </section>
)}
{activeView === "test-suites" && (
  <section>
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Production Readiness Test Suites
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Repeatable validation suites for agent behavior,
          tool selection, policy compliance, and quality.
        </p>
      </div>

      <button
        type="button"
        onClick={loadTestSuites}
        disabled={testSuitesLoading}
        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
      >
        {testSuitesLoading
          ? "Refreshing..."
          : "Refresh"}
      </button>
    </div>

{testSuitesError && (
  <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
    {testSuitesError}
  </div>
)}

{suiteRunError && (
  <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
    {suiteRunError}
  </div>
)}

    {testSuitesLoading && (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
        Loading test suites...
      </div>
    )}

    {!testSuitesLoading &&
      testSuites.length === 0 &&
      !testSuitesError && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="font-medium text-slate-700">
            No test suites available.
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Create a test suite to begin validating
            enterprise AI agent behavior.
          </p>
        </div>
      )}

    {!testSuitesLoading &&
      testSuites.length > 0 && (
        <div className="space-y-6">
          {testSuites.map((suite) => (
            <div
              key={suite.suite_id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="border-b border-slate-200 p-6">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {suite.name}
                      </h3>

                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-600">
                        {suite.status}
                      </span>
                    </div>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {suite.description ||
                        "No description provided."}
                    </p>

                    <p
                      className="mt-3 font-mono text-xs text-slate-400"
                      title={suite.suite_id}
                    >
                      Suite {suite.suite_id.slice(0, 8)}
                    </p>
                  </div>

<div className="flex flex-col items-stretch gap-3 sm:min-w-[190px]">
  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
      Test Cases
    </p>

    <p className="mt-1 text-2xl font-semibold text-slate-900">
      {suite.test_cases?.length ?? 0}
    </p>
  </div>

  <button
    type="button"
    onClick={() => {
      setTestGeneratorSuiteId(
        testGeneratorSuiteId === suite.suite_id
          ? null
          : suite.suite_id
      );

      setGeneratedTests([]);
      setSelectedGeneratedTests([]);
      setTestGeneratorError("");
      setTestGeneratorMessage("");
    }}
    className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
  >
    {testGeneratorSuiteId === suite.suite_id
      ? "Close AI Generator"
      : "Generate Tests with AI"}
  </button>

  <button
    type="button"
    onClick={() =>
      runTestSuite(suite.suite_id)
    }
    disabled={
      runningSuiteId === suite.suite_id
    }
    className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
  >
    {runningSuiteId === suite.suite_id
      ? "Running Suite..."
      : "Run Suite"}
  </button>
</div>
                </div>
              </div>

              <div className="p-6">
              {reliabilityScoreLoading[suite.suite_id] ? (
  <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6">
    <p className="text-sm text-slate-500">
      Calculating reliability score...
    </p>
  </div>
) : reliabilityScores[suite.suite_id] ? (
  <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="flex flex-col justify-between gap-5 border-b border-slate-200 p-6 lg:flex-row lg:items-center">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Production Readiness
        </p>

        <div className="mt-2 flex flex-wrap items-end gap-3">
          <p className="text-4xl font-semibold tracking-tight text-slate-900">
            {reliabilityScores[suite.suite_id].score}
          </p>

          <p className="pb-1 text-lg font-medium text-slate-400">
            / 100
          </p>
        </div>

        <p className="mt-2 text-sm font-semibold text-emerald-700">
          {reliabilityScores[suite.suite_id].readiness}
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
          Reliability Score
        </p>

        <p className="mt-1 text-2xl font-semibold text-emerald-800">
          {reliabilityScores[suite.suite_id].score}
        </p>
      </div>
    </div>

    <div className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
      <div className="bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Pass Rate
        </p>

        <p className="mt-2 text-xl font-semibold text-slate-900">
          {reliabilityScores[suite.suite_id].pass_rate}%
        </p>

        <p className="mt-1 text-xs text-slate-500">
          Latest production-readiness run
        </p>
      </div>

      <div className="bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Evaluation Quality
        </p>

        <p className="mt-2 text-xl font-semibold text-slate-900">
          {reliabilityScores[suite.suite_id].average_evaluation_score}
        </p>

        <p className="mt-1 text-xs text-slate-500">
          Average evaluator score
        </p>
      </div>

      <div className="bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Policy Compliance
        </p>

        <p className="mt-2 text-xl font-semibold text-slate-900">
          {reliabilityScores[suite.suite_id].policy_compliance_rate}%
        </p>

        <p className="mt-1 text-xs text-slate-500">
          Approval and policy checks
        </p>
      </div>

      <div className="bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Regression Stability
        </p>

        <p className="mt-2 text-xl font-semibold text-slate-900">
          {reliabilityScores[suite.suite_id].regression_stability}%
        </p>

        <p className="mt-1 text-xs text-slate-500">
          Stability across suite runs
        </p>
      </div>
    </div>

    <div className="border-t border-slate-100 bg-slate-50 px-6 py-3">
      <p className="text-xs leading-5 text-slate-500">
        Platform-defined readiness score combining pass rate,
        evaluation quality, policy compliance, and regression stability.
      </p>
    </div>
  </div>
) : null}
              {testGeneratorSuiteId === suite.suite_id && (
  <div className="mb-6 rounded-2xl border border-violet-200 bg-violet-50/50 p-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-500">
          AI Test Generator
        </p>

        <h4 className="mt-1 text-lg font-semibold text-slate-900">
          Generate production-readiness tests
        </h4>

        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
          Describe the agent and its tools. AI will generate realistic
          normal, protected-action, edge-case, failure, and adversarial tests
          for human review before they are added to this suite.
        </p>
      </div>

      <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200">
        Human-reviewed
      </span>
    </div>

    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Agent Name
        </label>

        <input
          type="text"
          value={testGeneratorAgentName}
          onChange={(event) =>
            setTestGeneratorAgentName(
              event.target.value
            )
          }
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Number of Tests
        </label>

        <input
          type="number"
          min={3}
          max={20}
          value={testGeneratorCount}
          onChange={(event) =>
            setTestGeneratorCount(
              Number(event.target.value)
            )
          }
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
        />
      </div>
    </div>

    <div className="mt-4">
      <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Agent Description
      </label>

      <textarea
        value={testGeneratorAgentDescription}
        onChange={(event) =>
          setTestGeneratorAgentDescription(
            event.target.value
          )
        }
        rows={4}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
      />
    </div>

    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Available Tools
        </label>

        <input
          type="text"
          value={testGeneratorAvailableTools}
          onChange={(event) =>
            setTestGeneratorAvailableTools(
              event.target.value
            )
          }
          placeholder="get_system_status, restart_service"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm text-slate-800 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
        />

        <p className="mt-2 text-xs text-slate-400">
          Separate tool names with commas.
        </p>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Protected Tools
        </label>

        <input
          type="text"
          value={testGeneratorProtectedTools}
          onChange={(event) =>
            setTestGeneratorProtectedTools(
              event.target.value
            )
          }
          placeholder="restart_service"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm text-slate-800 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
        />

        <p className="mt-2 text-xs text-slate-400">
          Protected tools should require human approval.
        </p>
      </div>
    </div>

    {testGeneratorError && (
      <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {testGeneratorError}
      </div>
    )}

    {testGeneratorMessage && (
      <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
        {testGeneratorMessage}
      </div>
    )}

    <div className="mt-5 flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={
          testGeneratorLoading ||
          !testGeneratorAgentName.trim() ||
          !testGeneratorAgentDescription.trim()
        }
        onClick={() =>
          generateAITests(suite.suite_id)
        }
        className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {testGeneratorLoading
          ? "Generating Tests..."
          : "Generate with AI"}
      </button>

      <p className="text-xs text-slate-500">
        Generated tests are not saved automatically.
      </p>
    </div>
   {generatedTests.length > 0 && (
  <div className="mt-6">
    <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div>
        <h5 className="text-base font-semibold text-slate-900">
          Generated Test Preview
        </h5>

        <p className="mt-1 text-sm text-slate-500">
          Review the AI-generated tests before adding them to this suite.
        </p>
      </div>

      <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
        {selectedGeneratedTests.length} of {generatedTests.length} selected
      </span>
    </div>

    <div className="space-y-4">
      {generatedTests.map((test, index) => {
        const isSelected =
          selectedGeneratedTests.includes(index);

        return (
          <div
            key={`${test.name}-${index}`}
            className={`rounded-2xl border p-5 transition ${
              isSelected
                ? "border-violet-200 bg-white"
                : "border-slate-200 bg-slate-50 opacity-70"
            }`}
          >
            <div className="flex items-start gap-4">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {
                  setSelectedGeneratedTests(
                    (current) =>
                      current.includes(index)
                        ? current.filter(
                            (item) => item !== index
                          )
                        : [...current, index]
                  );
                }}
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h6 className="font-semibold text-slate-900">
                    {test.name}
                  </h6>

                  <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
                    {test.category}
                  </span>
                </div>

                <div className="mt-4 rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Test Prompt
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {test.input_prompt}
                  </p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 p-3">
                    <p className="text-xs text-slate-400">
                      Expected Tool
                    </p>

                    <p className="mt-1 break-all font-mono text-xs font-semibold text-slate-700">
                      {test.expected_tool ?? "None"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-3">
                    <p className="text-xs text-slate-400">
                      Approval Required
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {test.expected_approval_required === null
                        ? "Not specified"
                        : test.expected_approval_required
                          ? "Yes"
                          : "No"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-3">
                    <p className="text-xs text-slate-400">
                      Minimum Score
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {test.min_evaluation_score ?? "Not set"}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Why this test matters
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {test.rationale}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>

    <div className="mt-5 flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
      <div>
        <p className="text-sm font-semibold text-slate-900">
          Ready to add selected tests?
        </p>

        <p className="mt-1 text-xs text-slate-500">
          {selectedGeneratedTests.length} of{" "}
          {generatedTests.length} tests selected.
          Nothing is saved until you confirm.
        </p>
      </div>

      <button
        type="button"
        onClick={saveSelectedGeneratedTests}
        disabled={
          testGeneratorSaving ||
          selectedGeneratedTests.length === 0
        }
        className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {testGeneratorSaving
          ? "Adding Tests..."
          : `Add Selected Tests to Suite (${selectedGeneratedTests.length})`}
      </button>
    </div>
  </div>
)}
  </div>
)}
                {suiteRegressionLoading[suite.suite_id] && (
                  <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    Loading reliability trend...
                  </div>
                )}

                {!suiteRegressionLoading[suite.suite_id] &&
                  suiteRegressions[suite.suite_id] && (
                    <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                      {(() => {
                        const regression =
                          suiteRegressions[suite.suite_id];

                        const statusLabel =
                          regression.status === "improved"
                            ? "Improved"
                            : regression.status === "regressed"
                              ? "Regressed"
                              : regression.status === "stable"
                                ? "Stable"
                                : regression.status === "first_run"
                                  ? "First Run"
                                  : "No Runs";

                        const statusClasses =
                          regression.status === "improved"
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : regression.status === "regressed"
                              ? "bg-red-50 text-red-700 ring-red-200"
                              : regression.status === "stable"
                                ? "bg-blue-50 text-blue-700 ring-blue-200"
                                : "bg-slate-100 text-slate-600 ring-slate-200";

                        const passRateChange =
                          regression.pass_rate_change;

                        return (
                          <>
                            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                                  Reliability Trend
                                </p>

                                <div className="mt-2 flex flex-wrap items-center gap-3">
                                  <h4 className="text-lg font-semibold text-slate-900">
                                    Regression Analysis
                                  </h4>

                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${statusClasses}`}
                                  >
                                    {statusLabel}
                                  </span>
                                </div>

                                <p className="mt-2 text-sm text-slate-500">
                                  Latest production-readiness run
                                  compared with the previous run.
                                </p>
                              </div>

                              {regression.current_run && (
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                  <TraceSummary
                                    label="Previous"
                                    value={
                                      regression.previous_run
                                        ? `${regression.previous_run.pass_rate}%`
                                        : "-"
                                    }
                                  />

                                  <TraceSummary
                                    label="Current"
                                    value={`${regression.current_run.pass_rate}%`}
                                  />

                                  <TraceSummary
                                    label="Change"
                                    value={
                                      passRateChange === null
                                        ? "-"
                                        : `${passRateChange > 0 ? "+" : ""}${passRateChange} pp`
                                    }
                                  />
                                </div>
                              )}
                            </div>

                            {regression.current_run &&
                              regression.previous_run && (
                                <div className="mt-5 grid gap-3 border-t border-slate-200 pt-5 sm:grid-cols-3">
                                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                      Current Failures
                                    </p>

                                    <p className="mt-1 text-xl font-semibold text-slate-900">
                                      {
                                        regression.current_run
                                          .failed_tests
                                      }
                                    </p>
                                  </div>

                                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                      Previous Failures
                                    </p>

                                    <p className="mt-1 text-xl font-semibold text-slate-900">
                                      {
                                        regression.previous_run
                                          .failed_tests
                                      }
                                    </p>
                                  </div>

                                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                      Failure Delta
                                    </p>

                                    <p
                                      className={`mt-1 text-xl font-semibold ${
                                        (regression.failed_tests_change ??
                                          0) > 0
                                          ? "text-red-600"
                                          : (regression.failed_tests_change ??
                                                0) < 0
                                            ? "text-emerald-700"
                                            : "text-slate-900"
                                      }`}
                                    >
                                      {regression.failed_tests_change ===
                                      null
                                        ? "-"
                                        : `${
                                            regression.failed_tests_change >
                                            0
                                              ? "+"
                                              : ""
                                          }${regression.failed_tests_change}`}
                                    </p>
                                  </div>
                                </div>
                              )}
                          </>
                        );
                      })()}
                    </div>
                  )}
{caseRegressionLoading[suite.suite_id] && (
  <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
    Loading behavior regression analysis...
  </div>
)}

{!caseRegressionLoading[suite.suite_id] &&
  caseRegressions[suite.suite_id] && (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {(() => {
        const caseRegression =
          caseRegressions[suite.suite_id];

        const allCases = [
          ...caseRegression.regressions.map((item) => ({
            ...item,
            trend: "regressed",
          })),
          ...caseRegression.improvements.map((item) => ({
            ...item,
            trend: "improved",
          })),
          ...caseRegression.stable_cases.map((item) => ({
            ...item,
            trend: "stable",
          })),
        ];

        return (
          <>
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Behavior Regression
                </p>

                <h4 className="mt-1 text-lg font-semibold text-slate-900">
                  Test Case Stability
                </h4>

                <p className="mt-2 text-sm text-slate-500">
                  Identifies which individual agent behaviors
                  improved, remained stable, or regressed.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <TraceSummary
                  label="Regressed"
                  value={
                    caseRegression.regression_count ?? 0
                  }
                />

                <TraceSummary
                  label="Improved"
                  value={
                    caseRegression.improvement_count ?? 0
                  }
                />

                <TraceSummary
                  label="Stable"
                  value={
                    caseRegression.stable_count ?? 0
                  }
                />
              </div>
            </div>

            <div className="mt-5 space-y-3 border-t border-slate-200 pt-5">
              {allCases.map((item) => {
                const badgeClasses =
                  item.trend === "regressed"
                    ? "bg-red-50 text-red-700 ring-red-200"
                    : item.trend === "improved"
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : "bg-slate-100 text-slate-600 ring-slate-200";

                return (
                  <div
                    key={item.case_id}
                    className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="font-medium text-slate-800">
                        {item.case_name}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                        <span>
                          Previous:{" "}
                          <strong className="font-medium text-slate-700">
                            {item.previous_passed
                              ? "PASS"
                              : "FAIL"}
                          </strong>
                        </span>

                        <span>
                          Current:{" "}
                          <strong className="font-medium text-slate-700">
                            {item.current_passed
                              ? "PASS"
                              : "FAIL"}
                          </strong>
                        </span>

                        <span>
                          Score:{" "}
                          <strong className="font-medium text-slate-700">
                            {item.previous_score ?? "-"}
                            {" → "}
                            {item.current_score ?? "-"}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${badgeClasses}`}
                    >
                      {item.trend}
                    </span>
                  </div>
                );
              })}

              {allCases.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                  No comparable case-level regression data
                  is available yet.
                </div>
              )}
            </div>
          </>
        );
      })()}
    </div>
  )}
                <div className="mb-4">
                  <h4 className="font-semibold text-slate-900">
                    Test Cases
                  </h4>

                  <p className="mt-1 text-sm text-slate-500">
                    Expected production behavior defined
                    for this suite.
                  </p>
                </div>

                <div className="space-y-3">
                  {(suite.test_cases ?? []).map(
                    (testCase) => (
                      <div
                        key={testCase.case_id}
                        className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
                      >
                        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-800">
                                {testCase.name}
                              </p>

                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                  testCase.enabled
                                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                                    : "bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200"
                                }`}
                              >
                                {testCase.enabled
                                  ? "Enabled"
                                  : "Disabled"}
                              </span>
                            </div>

                            <p className="mt-2 text-sm text-slate-600">
                              {testCase.input_prompt}
                            </p>
                          </div>

                          <div className="grid min-w-[260px] grid-cols-2 gap-2">
                            <div className="rounded-lg border border-slate-200 bg-white p-3">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                Expected Tool
                              </p>

                              <p className="mt-1 break-all font-mono text-xs font-medium text-slate-700">
                                {testCase.expected_tool ??
                                  "Any"}
                              </p>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-white p-3">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                Min Score
                              </p>

                              <p className="mt-1 text-xs font-medium text-slate-700">
                                {testCase.min_evaluation_score !==
                                null
                                  ? `${testCase.min_evaluation_score}/100`
                                  : "Any"}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3 text-xs text-slate-500">
                          <span>
                            Approval expected:{" "}
                            <strong className="font-medium text-slate-700">
                              {testCase.expected_approval_required ===
                              null
                                ? "Any"
                                : testCase.expected_approval_required
                                  ? "Yes"
                                  : "No"}
                            </strong>
                          </span>

                          <span>•</span>

                          <span
                            className="font-mono"
                            title={testCase.case_id}
                          >
                            Case{" "}
                            {testCase.case_id.slice(0, 8)}
                          </span>
                        </div>
                      </div>
                    )
                  )}

                  {(suite.test_cases ?? []).length ===
                    0 && (
                    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                      No test cases have been added to
                      this suite.
                    </div>
                  )}
                </div>
{suiteRunResults[suite.suite_id] && (
  <div className="mt-6 border-t border-slate-200 pt-6">
    {(() => {
      const result =
        suiteRunResults[suite.suite_id];

      return (
        <div
          className={`rounded-2xl border p-5 ${
            result.status === "passed"
              ? "border-emerald-200 bg-emerald-50/60"
              : "border-red-200 bg-red-50/60"
          }`}
        >
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Suite Result
              </p>

              <h4 className="mt-1 text-xl font-semibold capitalize text-slate-900">
                {result.status}
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <TraceSummary
                label="Tests"
                value={result.total_tests}
              />

              <TraceSummary
                label="Passed"
                value={result.passed_tests}
              />

              <TraceSummary
                label="Failed"
                value={result.failed_tests}
              />

              <TraceSummary
                label="Pass Rate"
                value={`${result.pass_rate}%`}
              />
            </div>
          </div>

          <div className="mt-5 space-y-2 border-t border-slate-200/70 pt-5">
            {result.results.map(
              (testResult) => (
                <div
                  key={testResult.case_id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-white/80 bg-white p-4 sm:flex-row sm:items-center"
                >
                  <div>
                    <p className="font-medium text-slate-800">
                      {testResult.test_name}
                    </p>

                    {testResult.failed_checks.length >
                      0 && (
                      <p className="mt-1 text-xs text-red-600">
                        Failed checks:{" "}
                        {testResult.failed_checks.join(
                          ", "
                        )}
                      </p>
                    )}

                    {testResult.error && (
                      <p className="mt-1 text-xs text-red-600">
                        {testResult.error}
                      </p>
                    )}
                  </div>

                  <StatusBadge
                    status={testResult.status}
                  />
                </div>
              )
            )}
          </div>
        </div>
      );
    })()}
  </div>
)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Test Suite Run History
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Persistent production-readiness results across
              previous suite executions.
            </p>
          </div>

          <button
            type="button"
            onClick={loadTestSuiteRunHistory}
            disabled={suiteRunHistoryLoading}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {suiteRunHistoryLoading
              ? "Refreshing..."
              : "Refresh History"}
          </button>
        </div>

        {suiteRunHistoryError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {suiteRunHistoryError}
          </div>
        )}

        {suiteRunHistoryLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
            Loading suite run history...
          </div>
        )}

        {!suiteRunHistoryLoading &&
          suiteRunHistory.length === 0 &&
          !suiteRunHistoryError && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <p className="font-medium text-slate-700">
                No suite run history yet.
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Run a test suite to create the first
                production-readiness record.
              </p>
            </div>
          )}

        {!suiteRunHistoryLoading &&
          suiteRunHistory.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Run
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Status
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Tests
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Passed
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Failed
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Pass Rate
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Started
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {suiteRunHistory.map((run) => (
                      <tr
                        key={run.suite_run_id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4">
                          <div>
                            <p className="text-sm font-medium text-slate-800">
                              {run.suite_name}
                            </p>

                            <p
                              className="mt-1 font-mono text-xs text-slate-400"
                              title={run.suite_run_id}
                            >
                              {run.suite_run_id.slice(0, 8)}
                            </p>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge
                            status={run.status}
                          />
                        </td>

                        <td className="px-5 py-4 text-sm font-medium text-slate-700">
                          {run.total_tests}
                        </td>

                        <td className="px-5 py-4 text-sm font-medium text-emerald-700">
                          {run.passed_tests}
                        </td>

                        <td className="px-5 py-4 text-sm font-medium text-red-600">
                          {run.failed_tests}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`text-sm font-semibold ${
                              run.pass_rate >= 90
                                ? "text-emerald-700"
                                : run.pass_rate >= 70
                                  ? "text-amber-700"
                                  : "text-red-600"
                            }`}
                          >
                            {run.pass_rate}%
                          </span>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-500">
                          {run.started_at
                            ? new Date(
                                run.started_at
                              ).toLocaleString()
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
      </div>
  </section>
)}
{activeView === "approvals" && (
  <section>
    <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Approval Queue
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Protected enterprise actions requested by AI agents.
        </p>
      </div>

      <button
        type="button"
        onClick={loadApprovals}
        disabled={approvalsLoading}
        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
      >
        {approvalsLoading ? "Refreshing..." : "Refresh"}
      </button>
    </div>

    {/* APPROVAL FILTERS */}
    <div className="mb-5 flex flex-wrap gap-2">
      {[
        { key: "all", label: "All" },
        { key: "pending", label: "Pending" },
        { key: "approved", label: "Approved" },
        { key: "executed", label: "Executed" },
        { key: "rejected", label: "Rejected" },
      ].map((filter) => (
        <button
          key={filter.key}
          type="button"
          onClick={() =>
            setApprovalFilter(
              filter.key as
                | "all"
                | "pending"
                | "approved"
                | "executed"
                | "rejected"
            )
          }
          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
            approvalFilter === filter.key
              ? "bg-slate-900 text-white"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          {filter.label}
        </button>
      ))}
    </div>

    {approvalsError && (
      <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {approvalsError}
      </div>
    )}

    {approvalsLoading && (
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
        Loading approval requests...
      </div>
    )}

    {!approvalsLoading && filteredApprovals.length === 0 && (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        No approval requests recorded yet.
      </div>
    )}

    {!approvalsLoading && filteredApprovals.length > 0 && (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr className="text-xs uppercase tracking-wider text-slate-500">
                <th className="px-5 py-4 font-medium">
                  Tool
                </th>

                <th className="px-5 py-4 font-medium">
                  Status
                </th>

                <th className="px-5 py-4 font-medium">
                  Approval ID
                </th>

                <th className="px-5 py-4 font-medium">
                  Requested
                </th>

                <th className="px-5 py-4 font-medium">
                  Decision
                </th>

                <th className="px-5 py-4 font-medium">
                  Execution
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredApprovals.map((approval) => (
                <tr
                  key={approval.approval_id}
                  onClick={() => openApprovalDetails(approval)}
                  className="cursor-pointer text-sm transition hover:bg-slate-50"
                >
                  <td className="px-5 py-4">
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-700">
                      {approval.tool_name}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge status={approval.status} />
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className="font-mono text-xs text-slate-600"
                      title={approval.approval_id}
                    >
                      {approval.approval_id.slice(0, 8)}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                    {formatDate(approval.created_at)}
                  </td>

                  <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                    {formatDate(approval.decided_at)}
                  </td>

                  <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                    {formatDate(approval.executed_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
    {/* SELECTED APPROVAL DETAILS */}
{selectedApproval && (
  <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Approval Review
        </p>

        <h3 className="mt-1 text-xl font-semibold text-slate-900">
          Protected Action Details
        </h3>

        <p className="mt-2 text-sm text-slate-500">
          Review the requested enterprise action and its governance history.
        </p>
      </div>

      <button
        type="button"
        onClick={() => {
          setSelectedApproval(null);
          setSelectedApprovalTimeline([]);
          setSelectedApprovalMessage("");
        }}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
      >
        Close
      </button>
    </div>

    {selectedApprovalLoading && (
      <p className="mt-5 text-sm text-slate-500">
        Loading approval details...
      </p>
    )}

    {!selectedApprovalLoading && (
      <>
        {/* Approval summary */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TraceSummary
            label="Tool"
            value={selectedApproval.tool_name}
          />

          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Status
            </p>

            <div className="mt-2">
              <StatusBadge status={selectedApproval.status} />
            </div>
          </div>

          <TraceSummary
            label="Requested"
            value={formatDate(selectedApproval.created_at)}
          />

          <TraceSummary
            label="Decision"
            value={formatDate(selectedApproval.decided_at)}
          />
        </div>

        {/* Approval ID */}
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Approval ID
          </p>

          <p className="mt-2 break-all font-mono text-sm text-slate-700">
            {selectedApproval.approval_id}
          </p>
        </div>
      {/* APPROVAL ACTIONS */}
<div className="mt-6 flex flex-wrap items-center gap-3">
  {selectedApproval.status === "pending" && (
    <>
      <button
        type="button"
        disabled={selectedApprovalLoading}
        onClick={() =>
          handleSelectedApprovalAction("approve")
        }
        className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {selectedApprovalLoading
          ? "Processing..."
          : "Approve"}
      </button>

      <button
        type="button"
        disabled={selectedApprovalLoading}
        onClick={() =>
          handleSelectedApprovalAction("reject")
        }
        className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Reject
      </button>
    </>
  )}

  {selectedApproval.status === "approved" && (
    <button
      type="button"
      disabled={selectedApprovalLoading}
      onClick={() =>
        handleSelectedApprovalAction("execute")
      }
      className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {selectedApprovalLoading
        ? "Executing..."
        : "Execute Approved Action"}
    </button>
  )}

  {selectedApproval.status === "executed" && (
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700">
      Action Executed
    </div>
  )}

  {selectedApproval.status === "rejected" && (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">
      Action Rejected
    </div>
  )}
</div>
        {/* Tool arguments */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Requested Arguments
          </p>

          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs text-slate-700">
            {JSON.stringify(
              selectedApproval.arguments ?? {},
              null,
              2
            )}
          </pre>
        </div>

        {selectedApprovalMessage && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {selectedApprovalMessage}
          </div>
        )}

        {/* GOVERNANCE TIMELINE */}
        <div className="mt-7 border-t border-slate-100 pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-slate-900">
                Governance Timeline
              </h4>

              <p className="mt-1 text-sm text-slate-500">
                Complete approval and execution history.
              </p>
            </div>

            <span className="text-xs text-slate-500">
              {selectedApprovalTimeline.length} events
            </span>
          </div>

          {selectedApprovalTimeline.length === 0 && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              No governance events are available.
            </div>
          )}

          {selectedApprovalTimeline.length > 0 && (
            <div className="mt-6 space-y-0">
              {selectedApprovalTimeline.map(
                (event, index) => (
                  <div
                    key={
                      event.id ??
                      `${event.event_type}-${event.created_at}-${index}`
                    }
                    className="relative flex gap-4"
                  >
                    <div className="flex w-5 flex-col items-center">
                      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-700 ring-4 ring-white" />

                      {index <
                        selectedApprovalTimeline.length -
                          1 && (
                        <div className="my-1 w-px flex-1 bg-slate-200" />
                      )}
                    </div>

                    <div className="mb-4 flex-1 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {formatNodeName(
                              event.event_type
                            )}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {event.tool_name ??
                              selectedApproval.tool_name}
                          </p>
                        </div>

                        <StatusBadge
                          status={event.status}
                        />
                      </div>

                      {event.created_at && (
                        <p className="mt-3 text-xs text-slate-400">
                          {formatDate(
                            event.created_at
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </>
    )}
  </div>
)}
  </section>
)}
       </div>
     </div>
   </div>
  </div>
 </main>
 );
}

function MetricCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string | number;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {value}
          </div>

          <p className="mt-2 text-sm text-slate-500">
            {subtitle}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
          <div className="h-2.5 w-2.5 rounded-full bg-slate-700" />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();

  if (
    normalized === "completed" ||
    normalized === "approved"  ||
    normalized === "passed"
  ) {
    return (
      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
        {formatNodeName(status)}
      </span>
    );
  }

  if (
    normalized === "failed" ||
    normalized === "rejected"
  ) {
    return (
      <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
        {formatNodeName(status)}
      </span>
    );
  }

  if (normalized === "pending") {
    return (
      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
        Pending
      </span>
    );
  }

  if (normalized === "executed") {
    return (
      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
        Executed
      </span>
    );
  }

  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
      {formatNodeName(status)}
    </span>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
}
function TraceSummary({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="mt-1 font-medium text-slate-800">
        {value}
      </p>
    </div>
  );
}


function TraceDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="mt-0.5 text-xs font-medium text-slate-700">
        {value}
      </p>
    </div>
  );
}


function formatNodeName(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}


function formatTraceValue(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}
