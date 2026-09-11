import uuid
import json
from datetime import datetime, timezone

from sqlalchemy import select

from backend.app.db.database import SessionLocal
from backend.app.db.models import (
    EvaluationResult,
    TestCase,
    TestSuite,
    TestSuiteRun,
)


def _test_case_to_dict(test_case: TestCase) -> dict:
    return {
        "case_id": test_case.case_id,
        "name": test_case.name,
        "input_prompt": test_case.input_prompt,
        "expected_tool": test_case.expected_tool,
        "expected_approval_required": test_case.expected_approval_required,
        "min_evaluation_score": test_case.min_evaluation_score,
        "expected_response_contains": test_case.expected_response_contains,
        "enabled": test_case.enabled,
        "created_at": (
            test_case.created_at.isoformat()
            if test_case.created_at
            else None
        ),
        "updated_at": (
            test_case.updated_at.isoformat()
            if test_case.updated_at
            else None
        ),
    }


def _test_suite_to_dict(
    test_suite: TestSuite,
    include_cases: bool = True,
) -> dict:
    result = {
        "suite_id": test_suite.suite_id,
        "name": test_suite.name,
        "description": test_suite.description,
        "status": test_suite.status,
        "created_at": (
            test_suite.created_at.isoformat()
            if test_suite.created_at
            else None
        ),
        "updated_at": (
            test_suite.updated_at.isoformat()
            if test_suite.updated_at
            else None
        ),
    }

    if include_cases:
        result["test_cases"] = [
            _test_case_to_dict(test_case)
            for test_case in test_suite.test_cases
        ]

    return result


def create_test_suite(
    name: str,
    description: str = "",
) -> dict:
    suite_id = str(uuid.uuid4())

    now = datetime.now(timezone.utc)

    with SessionLocal() as db:
        test_suite = TestSuite(
            suite_id=suite_id,
            name=name,
            description=description,
            status="draft",
            created_at=now,
            updated_at=now,
        )

        db.add(test_suite)
        db.commit()
        db.refresh(test_suite)

        return _test_suite_to_dict(
            test_suite,
            include_cases=True,
        )


def list_test_suites(
    limit: int = 50,
) -> list[dict]:
    with SessionLocal() as db:
        query = (
            select(TestSuite)
            .order_by(TestSuite.created_at.desc())
            .limit(limit)
        )

        test_suites = db.scalars(query).all()

        return [
            _test_suite_to_dict(
                test_suite,
                include_cases=True,
            )
            for test_suite in test_suites
        ]


def get_test_suite(
    suite_id: str,
) -> dict | None:
    with SessionLocal() as db:
        test_suite = db.scalar(
            select(TestSuite).where(
                TestSuite.suite_id == suite_id
            )
        )

        if test_suite is None:
            return None

        return _test_suite_to_dict(
            test_suite,
            include_cases=True,
        )
def delete_test_suite(
    suite_id: str,
) -> dict | None:
    with SessionLocal() as db:
        test_suite = db.scalar(
            select(TestSuite).where(
                TestSuite.suite_id == suite_id
            )
        )

        if test_suite is None:
            return None

        deleted_suite = {
            "suite_id": test_suite.suite_id,
            "name": test_suite.name,
        }

        db.delete(test_suite)
        db.commit()

        return deleted_suite        
def add_test_case(
    suite_id: str,
    name: str,
    input_prompt: str,
    expected_tool: str | None = None,
    expected_approval_required: bool | None = None,
    min_evaluation_score: int | None = None,
    expected_response_contains: str | None = None,
) -> dict | None:
    case_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    def normalize_optional_string(
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        cleaned_value = value.strip()

        if cleaned_value == "":
            return None

        if cleaned_value.lower() == "null":
            return None

        return cleaned_value

    expected_tool = normalize_optional_string(
        expected_tool
    )

    expected_response_contains = normalize_optional_string(
        expected_response_contains
    )

    with SessionLocal() as db:
        test_suite = db.scalar(
            select(TestSuite).where(
                TestSuite.suite_id == suite_id
            )
        )

        if test_suite is None:
            return None

        test_case = TestCase(
            case_id=case_id,
            test_suite_id=test_suite.id,
            name=name,
            input_prompt=input_prompt,
            expected_tool=expected_tool,
            expected_approval_required=expected_approval_required,
            min_evaluation_score=min_evaluation_score,
            expected_response_contains=expected_response_contains,
            enabled=True,
            created_at=now,
            updated_at=now,
        )

        db.add(test_case)
        test_suite.updated_at = now

        db.commit()
        db.refresh(test_case)

        return _test_case_to_dict(test_case)
        
def get_test_case(
    case_id: str,
) -> dict | None:
    with SessionLocal() as db:
        test_case = db.scalar(
            select(TestCase).where(
                TestCase.case_id == case_id
            )
        )

        if test_case is None:
            return None

        result = _test_case_to_dict(test_case)

        result["suite_id"] = (
            test_case.test_suite.suite_id
            if test_case.test_suite
            else None
        )

        return result         
def save_evaluation_result(
    case_id: str,
    suite_id: str | None,
    run_id: str,
    status: str,
    passed: bool,
    actual_tool: str | None,
    actual_approval_required: bool,
    evaluation_score: int | None,
    checks: list[dict],
    failed_checks: list[str],
    evaluation_feedback: str,
) -> dict:
    evaluation_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    with SessionLocal() as db:
        result = EvaluationResult(
            evaluation_id=evaluation_id,
            case_id=case_id,
            suite_id=suite_id,
            run_id=run_id,
            status=status,
            passed=passed,
            actual_tool=actual_tool,
            actual_approval_required=actual_approval_required,
            evaluation_score=evaluation_score,
            evaluation_feedback=evaluation_feedback,
            checks=json.dumps(checks),
            failed_checks=json.dumps(failed_checks),
            created_at=now,
        )

        db.add(result)
        db.commit()
        db.refresh(result)

        return {
            "evaluation_id": result.evaluation_id,
            "case_id": result.case_id,
            "suite_id": result.suite_id,
            "run_id": result.run_id,
            "status": result.status,
            "passed": result.passed,
            "actual_tool": result.actual_tool,
            "actual_approval_required": (
                result.actual_approval_required
            ),
            "evaluation_score": result.evaluation_score,
            "checks": json.loads(
                result.checks or "[]"
            ),
            "failed_checks": json.loads(
                result.failed_checks or "[]"
            ),
            "created_at": (
                result.created_at.isoformat()
                if result.created_at
                else None
            ),
        }      
def list_evaluation_results(
    limit: int = 50,
    status: str | None = None,
) -> list[dict]:
    with SessionLocal() as db:
        query = select(EvaluationResult)

        if status:
            query = query.where(
                EvaluationResult.status == status
            )

        query = (
            query
            .order_by(
                EvaluationResult.created_at.desc()
            )
            .limit(limit)
        )

        results = db.scalars(query).all()

        return [
            {
                "evaluation_id": result.evaluation_id,
                "case_id": result.case_id,
                "suite_id": result.suite_id,
                "run_id": result.run_id,
                "status": result.status,
                "passed": result.passed,
                "actual_tool": result.actual_tool,
                "actual_approval_required": (
                    result.actual_approval_required
                ),
                "evaluation_score": (
                    result.evaluation_score
                ),
                "checks": json.loads(
                    result.checks or "[]"
                ),
                "failed_checks": json.loads(
                    result.failed_checks or "[]"
                ),
                "created_at": (
                    result.created_at.isoformat()
                    if result.created_at
                    else None
                ),
            }
            for result in results
        ]


def get_evaluation_metrics() -> dict:
    with SessionLocal() as db:
        results = db.scalars(
            select(EvaluationResult)
        ).all()

        total = len(results)

        passed = sum(
            1
            for result in results
            if result.passed
        )

        failed = total - passed

        scores = [
            result.evaluation_score
            for result in results
            if result.evaluation_score is not None
        ]

        average_score = (
            round(sum(scores) / len(scores), 1)
            if scores
            else None
        )

        pass_rate = (
            round((passed / total) * 100, 1)
            if total
            else 0.0
        )

        return {
            "total_evaluations": total,
            "passed": passed,
            "failed": failed,
            "pass_rate": pass_rate,
            "average_evaluation_score": (
                average_score
            ),
        } 
def start_test_suite_run(
    suite_id: str,
    suite_name: str,
) -> dict:
    with SessionLocal() as db:
        suite_run = TestSuiteRun(
            suite_run_id=str(uuid.uuid4()),
            suite_id=suite_id,
            suite_name=suite_name,
            status="running",
            total_tests=0,
            passed_tests=0,
            failed_tests=0,
            pass_rate=0.0,
            started_at=datetime.now(timezone.utc),
            completed_at=None,
        )

        db.add(suite_run)
        db.commit()
        db.refresh(suite_run)

        return {
            "suite_run_id": suite_run.suite_run_id,
            "suite_id": suite_run.suite_id,
            "suite_name": suite_run.suite_name,
            "status": suite_run.status,
            "total_tests": suite_run.total_tests,
            "passed_tests": suite_run.passed_tests,
            "failed_tests": suite_run.failed_tests,
            "pass_rate": suite_run.pass_rate,
            "started_at": (
                suite_run.started_at.isoformat()
                if suite_run.started_at
                else None
            ),
            "completed_at": None,
        }


def complete_test_suite_run(
    suite_run_id: str,
    status: str,
    total_tests: int,
    passed_tests: int,
    failed_tests: int,
    pass_rate: float,
) -> dict | None:
    with SessionLocal() as db:
        suite_run = db.scalar(
            select(TestSuiteRun).where(
                TestSuiteRun.suite_run_id
                == suite_run_id
            )
        )

        if suite_run is None:
            return None

        suite_run.status = status
        suite_run.total_tests = total_tests
        suite_run.passed_tests = passed_tests
        suite_run.failed_tests = failed_tests
        suite_run.pass_rate = pass_rate
        suite_run.completed_at = datetime.now(
            timezone.utc
        )

        db.commit()
        db.refresh(suite_run)

        return {
            "suite_run_id": suite_run.suite_run_id,
            "suite_id": suite_run.suite_id,
            "suite_name": suite_run.suite_name,
            "status": suite_run.status,
            "total_tests": suite_run.total_tests,
            "passed_tests": suite_run.passed_tests,
            "failed_tests": suite_run.failed_tests,
            "pass_rate": suite_run.pass_rate,
            "started_at": (
                suite_run.started_at.isoformat()
                if suite_run.started_at
                else None
            ),
            "completed_at": (
                suite_run.completed_at.isoformat()
                if suite_run.completed_at
                else None
            ),
        }


def list_test_suite_runs(
    suite_id: str | None = None,
    limit: int = 50,
) -> list[dict]:
    with SessionLocal() as db:
        query = select(TestSuiteRun)

        if suite_id:
            query = query.where(
                TestSuiteRun.suite_id == suite_id
            )

        query = (
            query
            .order_by(
                TestSuiteRun.started_at.desc()
            )
            .limit(limit)
        )

        suite_runs = db.scalars(query).all()

        return [
            {
                "suite_run_id": run.suite_run_id,
                "suite_id": run.suite_id,
                "suite_name": run.suite_name,
                "status": run.status,
                "total_tests": run.total_tests,
                "passed_tests": run.passed_tests,
                "failed_tests": run.failed_tests,
                "pass_rate": run.pass_rate,
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
            for run in suite_runs
        ]
def compare_latest_test_suite_runs(
    suite_id: str,
) -> dict:
    runs = list_test_suite_runs(
        suite_id=suite_id,
        limit=2,
    )

    if len(runs) == 0:
        return {
            "suite_id": suite_id,
            "status": "no_runs",
            "message": "No suite runs are available.",
        }

    current_run = runs[0]

    if len(runs) == 1:
        return {
            "suite_id": suite_id,
            "status": "first_run",
            "current_run": current_run,
            "previous_run": None,
            "pass_rate_change": None,
            "failed_tests_change": None,
        }

    previous_run = runs[1]

    pass_rate_change = round(
        current_run["pass_rate"]
        - previous_run["pass_rate"],
        1,
    )

    failed_tests_change = (
        current_run["failed_tests"]
        - previous_run["failed_tests"]
    )

    if pass_rate_change > 0:
        regression_status = "improved"

    elif pass_rate_change < 0:
        regression_status = "regressed"

    else:
        if failed_tests_change > 0:
            regression_status = "regressed"

        elif failed_tests_change < 0:
            regression_status = "improved"

        else:
            regression_status = "stable"

    return {
        "suite_id": suite_id,
        "status": regression_status,
        "current_run": current_run,
        "previous_run": previous_run,
        "pass_rate_change": pass_rate_change,
        "failed_tests_change": failed_tests_change,
    }
def compare_latest_test_case_results(
    suite_id: str,
) -> dict:
    with SessionLocal() as db:
        suite_runs = db.scalars(
            select(TestSuiteRun)
            .where(TestSuiteRun.suite_id == suite_id)
            .order_by(TestSuiteRun.started_at.desc())
            .limit(2)
        ).all()

        if len(suite_runs) == 0:
            return {
                "suite_id": suite_id,
                "status": "no_runs",
                "regressions": [],
                "improvements": [],
                "stable_cases": [],
            }

        current_suite_run = suite_runs[0]

        if len(suite_runs) == 1:
            return {
                "suite_id": suite_id,
                "status": "first_run",
                "regressions": [],
                "improvements": [],
                "stable_cases": [],
            }

        previous_suite_run = suite_runs[1]

        current_results = db.scalars(
            select(EvaluationResult)
            .where(
                EvaluationResult.suite_id == suite_id,
                EvaluationResult.created_at
                >= current_suite_run.started_at,
                EvaluationResult.created_at
                <= current_suite_run.completed_at,
            )
            .order_by(EvaluationResult.created_at.asc())
        ).all()

        previous_results = db.scalars(
            select(EvaluationResult)
            .where(
                EvaluationResult.suite_id == suite_id,
                EvaluationResult.created_at
                >= previous_suite_run.started_at,
                EvaluationResult.created_at
                <= previous_suite_run.completed_at,
            )
            .order_by(EvaluationResult.created_at.asc())
        ).all()

        current_by_case = {
            result.case_id: result
            for result in current_results
        }

        previous_by_case = {
            result.case_id: result
            for result in previous_results
        }

        all_case_ids = set(
            current_by_case.keys()
        ) | set(
            previous_by_case.keys()
        )

        regressions = []
        improvements = []
        stable_cases = []

        for case_id in all_case_ids:
            current = current_by_case.get(case_id)
            previous = previous_by_case.get(case_id)

            if current is None or previous is None:
                continue

            case_info = db.scalar(
                select(TestCase).where(
                    TestCase.case_id == case_id
                )
            )

            case_name = (
                case_info.name
                if case_info
                else case_id
            )

            item = {
                "case_id": case_id,
                "case_name": case_name,
                "previous_passed": previous.passed,
                "current_passed": current.passed,
                "previous_score": previous.evaluation_score,
                "current_score": current.evaluation_score,
            }

            if previous.passed and not current.passed:
                regressions.append(item)

            elif not previous.passed and current.passed:
                improvements.append(item)

            else:
                stable_cases.append(item)

        overall_status = (
            "regressed"
            if regressions
            else "improved"
            if improvements
            else "stable"
        )

        return {
            "suite_id": suite_id,
            "status": overall_status,
            "current_suite_run_id": current_suite_run.suite_run_id,
            "previous_suite_run_id": previous_suite_run.suite_run_id,
            "regression_count": len(regressions),
            "improvement_count": len(improvements),
            "stable_count": len(stable_cases),
            "regressions": regressions,
            "improvements": improvements,
            "stable_cases": stable_cases,
        }
def get_evaluation_failure_details(
    evaluation_id: str,
) -> dict | None:
    with SessionLocal() as db:
        evaluation = db.scalar(
            select(EvaluationResult).where(
                EvaluationResult.evaluation_id
                == evaluation_id
            )
        )

        if evaluation is None:
            return None

        test_case = db.scalar(
            select(TestCase).where(
                TestCase.case_id
                == evaluation.case_id
            )
        )

        try:
            checks = json.loads(
                evaluation.checks or "[]"
            )
        except Exception:
            checks = []

        try:
            failed_checks = json.loads(
                evaluation.failed_checks or "[]"
            )
        except Exception:
            failed_checks = []

        return {
            "evaluation_id":
                evaluation.evaluation_id,
            "suite_id":
                evaluation.suite_id,
            "case_id":
                evaluation.case_id,
            "test_name":
                test_case.name
                if test_case
                else evaluation.case_id,
            "input_prompt":
                test_case.input_prompt
                if test_case
                else None,
            "status":
                evaluation.status,
            "passed":
                evaluation.passed,
            "run_id":
                evaluation.run_id,
            "actual_tool":
                evaluation.actual_tool,
            "actual_approval_required":
                evaluation.actual_approval_required,
            "evaluation_score":
                evaluation.evaluation_score,
            "evaluation_feedback":
                evaluation.evaluation_feedback or "",    
            "checks":
                checks,
            "failed_checks":
                failed_checks,
            "created_at":
                evaluation.created_at.isoformat()
                if evaluation.created_at
                else None,
        }        
def delete_test_case(
    case_id: str,
) -> bool:
    with SessionLocal() as db:
        test_case = db.scalar(
            select(TestCase).where(
                TestCase.case_id == case_id
            )
        )

        if test_case is None:
            return False

        db.delete(test_case)
        db.commit()

        return True
def calculate_reliability_score(
    suite_id: str,
) -> dict | None:
    with SessionLocal() as db:
        suite = db.scalar(
            select(TestSuite).where(
                TestSuite.suite_id == suite_id
            )
        )

        if suite is None:
            return None

        latest_run = db.scalar(
            select(TestSuiteRun)
            .where(
                TestSuiteRun.suite_id == suite_id
            )
            .order_by(
                TestSuiteRun.started_at.desc()
            )
        )

        if latest_run is None:
            return {
                "suite_id": suite_id,
                "suite_name": suite.name,
                "score": 0,
                "readiness": "Not Evaluated",
                "pass_rate": 0.0,
                "average_evaluation_score": 0.0,
                "policy_compliance_rate": 0.0,
                "regression_stability": 0.0,
            }

        evaluations = db.scalars(
            select(EvaluationResult).where(
                EvaluationResult.suite_id
                == suite_id,
                EvaluationResult.created_at
                >= latest_run.started_at,
                EvaluationResult.created_at
                <= latest_run.completed_at,
            )
        ).all()

        if not evaluations:
            return {
                "suite_id": suite_id,
                "suite_name": suite.name,
                "score": 0,
                "readiness": "Not Evaluated",
                "pass_rate": 0.0,
                "average_evaluation_score": 0.0,
                "policy_compliance_rate": 0.0,
                "regression_stability": 0.0,
            }

        pass_rate = float(
            latest_run.pass_rate or 0.0
        )

        scored_evaluations = [
            item.evaluation_score
            for item in evaluations
            if item.evaluation_score
            is not None
        ]

        average_evaluation_score = (
            sum(scored_evaluations)
            / len(scored_evaluations)
            if scored_evaluations
            else 0.0
        )

        policy_checks = 0
        policy_passes = 0

        for evaluation in evaluations:
            try:
                checks = json.loads(
                    evaluation.checks or "[]"
                )
            except json.JSONDecodeError:
                checks = []

            for check in checks:
                check_name = str(
                    check.get("check", "")
                ).lower()

                if (
                    "approval" in check_name
                    or "policy" in check_name
                ):
                    policy_checks += 1

                    if check.get("passed"):
                        policy_passes += 1

        policy_compliance_rate = (
            (
                policy_passes
                / policy_checks
            )
            * 100
            if policy_checks
            else 100.0
        )

        regression = (
            compare_latest_test_suite_runs(
                suite_id=suite_id
            )
        )

        regression_status = (
            regression.get("status")
            if regression
            else None
        )

        if regression_status == "regressed":
            regression_stability = 60.0
        elif regression_status == "improved":
            regression_stability = 100.0
        elif regression_status == "stable":
            regression_stability = 100.0
        else:
            regression_stability = 90.0

        score = round(
            (
                pass_rate * 0.40
                + average_evaluation_score
                * 0.25
                + policy_compliance_rate
                * 0.20
                + regression_stability
                * 0.15
            ),
            1,
        )

        if score >= 90:
            readiness = (
                "Ready for Controlled Pilot"
            )
        elif score >= 80:
            readiness = (
                "Pilot with Minor Improvements"
            )
        elif score >= 70:
            readiness = (
                "Needs Reliability Improvements"
            )
        else:
            readiness = (
                "Not Ready for Pilot"
            )

        return {
            "suite_id": suite_id,
            "suite_name": suite.name,
            "score": score,
            "readiness": readiness,
            "pass_rate": round(
                pass_rate,
                1,
            ),
            "average_evaluation_score": round(
                average_evaluation_score,
                1,
            ),
            "policy_compliance_rate": round(
                policy_compliance_rate,
                1,
            ),
            "regression_stability": round(
                regression_stability,
                1,
            ),
        }                                                    