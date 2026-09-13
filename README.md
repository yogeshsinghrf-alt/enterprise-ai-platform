# Enterprise AI Agent Reliability & Control Platform

A production-oriented platform for **testing, evaluating, governing, monitoring, and controlling enterprise AI agents** before and during deployment.

The project demonstrates how organizations can move beyond standalone LLM prototypes toward AI systems with **reliability evaluation, human approval, policy controls, auditability, execution tracing, tool governance, and production-readiness assessment**.

> **V0.9 Status:** Deployed and validated for controlled-pilot use. The platform is a portfolio and pilot implementation, not an independently certified enterprise production system.

---

## Why This Project Exists

Building an AI agent that produces an answer is relatively easy.

Deploying one safely inside an enterprise is much harder.

Production AI systems need mechanisms to answer questions such as:

- Is the agent producing acceptable results?
- Is it using the correct enterprise tools?
- Are sensitive actions protected by human approval?
- What happens when an external API fails or times out?
- Can every important action be audited?
- Has agent behavior regressed between test runs?
- What is the reliability/readiness of the agent before deployment?
- Can failures be traced back to their cause?

This platform provides a control and reliability layer around enterprise AI agents to address those problems.

---

## Core Capabilities

### AI Agent Runtime

- Multi-stage agent workflow
- Planning, analysis, and response generation
- Google Gemini integration
- Enterprise tool execution
- Retrieval-Augmented Generation (RAG)
- Source citations
- Execution tracing
- Run-level quality and latency metrics

### AI Evaluation & Reliability

- Persistent test suites
- Individual AI test cases
- AI-assisted test generation
- Batch test execution
- LLM-based evaluation
- Deterministic operational assertions
- Pass/fail analysis
- Regression comparison
- Case-level regression analysis
- Failure Explorer
- Evaluator feedback
- Reliability / Production Readiness Score

### Governance & Human Control

- Tool risk classification
- Human-approval requirements
- Approval / rejection workflow
- Protected high-risk actions
- Approval replay protection
- Persistent audit trail
- Governance event history
- Read-only audit dashboard

### Enterprise Tools & MCP

The platform includes a tool registry designed around enterprise tool governance and MCP-oriented integration.

Example tools include:

- `get_system_status`
- `restart_service`
- `get_customer_account_status`
- `get_purchase_order_status`
- `approve_purchase_order`

Tools can be classified by:

- Risk level
- Approval requirement
- Execution policy

High-risk operations such as service restarts or purchase-order approvals require human authorization.

### External Agent/API Integration

The platform can evaluate agents outside its own runtime through authenticated API integration.

External-agent controls include:

- Endpoint validation
- Host allowlisting
- SSRF mitigation
- Timeout handling
- Malformed-response detection
- Upstream HTTP-error handling
- Integration-failure classification
- Redirect blocking

This allows the reliability platform to operate as a control/evaluation layer around independently hosted AI agents.

---

## Production Readiness Assessment

The platform calculates a platform-defined **Production Readiness / Reliability Score** using signals such as:

- Test pass rate
- Evaluation quality
- Policy compliance
- Regression stability

The score is intended as a decision-support indicator for controlled pilots and AI reliability assessments.

It should **not** be interpreted as an independent certification or guarantee of real-world AI reliability.

---

## Demo Enterprise Scenarios

Three enterprise scenarios are included in the deployed V0.9 demonstration.

### Customer Support AI Agent

Tests include:

- Customer account-status retrieval
- General customer-support response quality
- Tool-selection validation
- Evaluation scoring

### Finance & Procurement AI Agent

Tests include:

- Purchase-order status retrieval
- Purchase-order approval controls
- High-risk action governance
- Human approval enforcement

### IT Operations AI Agent

Tests include:

- System-health inspection
- Service-restart workflow
- High-risk operational controls
- Human approval enforcement

These scenarios demonstrate that the platform is domain-flexible rather than tied to one specific industry.

---

## Reliability & Failure Testing

The platform has been tested against multiple failure modes, including:

- Policy bypass attempts
- External integration failures
- API timeouts
- Malformed responses
- Upstream HTTP errors
- Provider/API failures
- Approval-controlled operations

Historical execution failures are retained rather than deleted, allowing the dashboard and audit trail to represent real operational history.

---

## Security & Controlled-Pilot Hardening

V0.9 includes several production-oriented controls:

- Password-protected dashboard
- HttpOnly signed session cookie
- Login brute-force protection
- Backend API-key authentication
- Role-scoped backend authentication primitives
- Server-side backend proxy
- Backend route allowlisting
- Execution rate limiting
- External-agent URL validation
- Host allowlisting
- SSRF mitigation
- Human approval for sensitive actions
- Persistent audit events
- Environment-based secret management
- Alembic-managed database migrations

### Current Access-Control Scope

V0.9 uses a **single-admin controlled-pilot dashboard**.

The backend contains Viewer / Operator / Admin role primitives, but the current dashboard uses a server-side Admin credential for authenticated sessions.

A full enterprise deployment would extend this with:

- SSO / OIDC
- User identities
- Role-bearing sessions
- Full route-level RBAC
- Tenant isolation
- Distributed rate limiting
- Enterprise secret management

---

## Architecture

```text
                    ┌───────────────────────────┐
                    │     Next.js Dashboard     │
                    │                           │
                    │ Runs • Evals • Approvals  │
                    │ Tools • Audit • Suites    │
                    └─────────────┬─────────────┘
                                  │
                         Secure Server Proxy
                                  │
                    ┌─────────────▼─────────────┐
                    │     FastAPI Control       │
                    │          Plane            │
                    └─────────────┬─────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
  LangGraph Agent          Evaluation Engine         Policy / Approval
     Runtime                                         Control Layer
        │                         │                         │
        ├──────────────┐          │                         │
        ▼              ▼          ▼                         ▼
  Gemini Models    RAG/Vector   Test Suites             Audit Trail
                   Retrieval    Regression
        │              │
        ▼              ▼
 Enterprise Tools   PostgreSQL
     / MCP            pgvector

        External Enterprise Agents / APIs
                     │
                     ▼
             External Agent Adapter
```

---

## Technology Stack

### AI / Agent Runtime

- Python 3.12
- LangGraph
- LangChain
- Google Gemini
- Google Generative AI Embeddings
- MCP Python SDK

### Backend

- FastAPI
- SQLAlchemy
- Pydantic
- REST APIs
- Python request integrations

### Data Layer

- PostgreSQL
- pgvector
- 3072-dimensional Gemini embeddings
- Alembic database migrations

### Frontend

- Next.js
- TypeScript
- React
- Tailwind CSS

### Deployment

- Vercel — frontend
- Render — FastAPI backend
- Render PostgreSQL
- GitHub — source control and deployment integration

---

## Dashboard

The web dashboard provides operational visibility across:

- Overview
- Agent Runs
- Human Approvals
- Evaluations
- Test Suites
- Reliability Scores
- Regression Analysis
- Failure Explorer
- Tools & MCP
- Audit Trail

The dashboard is designed to demonstrate how AI systems can be managed as operational enterprise services rather than isolated chatbot demonstrations.

---

## Database & Deployment Engineering

The project uses Alembic-managed schema migrations rather than relying on automatic table creation.

This provides:

- Version-controlled database evolution
- Repeatable deployment
- Safer production schema changes
- Environment consistency

Demo data seeding is idempotent so controlled-pilot environments can be initialized without duplicating test suites.

---

## Production Deployment

The platform is deployed using a separated frontend/control-plane architecture:

```text
User
  │
  ▼
Vercel
Next.js Dashboard
  │
  ▼
Authenticated Server Proxy
  │
  ▼
Render
FastAPI Control Plane
  │
  ├── Gemini APIs
  ├── PostgreSQL / pgvector
  ├── Enterprise Tools
  └── External Agent APIs
```

Secrets remain server-side and are not exposed to browser JavaScript.

---

## What Makes This Different From Direct LLM Usage?

A foundation model such as Gemini, GPT, or Claude provides intelligence and reasoning.

An enterprise deployment requires additional operational infrastructure around that intelligence.

This project focuses on that infrastructure:

**LLM**
→ reasoning

**Agent Runtime**
→ planning and tool use

**Reliability Platform**
→ testing, evaluation and regression analysis

**Control Plane**
→ policy, approvals and governance

**Operations Layer**
→ tracing, metrics and auditability

The objective is therefore not to replace foundation models, but to make AI-agent deployments more **measurable, controlled, auditable, and production-oriented**.

---

## Commercial Use Case

A practical commercial application of the platform is an:

### AI Agent Reliability & Production Readiness Assessment

A company can connect an AI agent or API and evaluate:

- Functional behavior
- Tool usage
- Response quality
- Policy compliance
- Human-approval controls
- Failure handling
- Regression stability
- Production-readiness indicators

The resulting evidence can support decisions such as:

**Ready for Controlled Pilot**

**Requires Remediation**

**Not Ready for Deployment**

---

## V0.9 Scope

V0.9 intentionally focuses on a controlled-pilot architecture.

It does not claim to provide:

- Independent AI certification
- Absolute reliability guarantees
- Full enterprise multi-tenancy
- Enterprise SSO
- Complete organization-wide RBAC
- Kubernetes-scale orchestration
- Full multi-provider failover
- Regulatory compliance certification

These are potential future extensions rather than claims about the current release.

---

## Roadmap

Potential future development includes:

- Multi-provider model routing
- GPT / Claude / Gemini provider abstraction
- Automated provider failover
- Golden evaluation datasets
- CI/CD AI quality gates
- Advanced regression testing
- OpenTelemetry observability
- Distributed rate limiting
- Enterprise SSO / OIDC
- Multi-tenant RBAC
- Advanced policy engine
- Model and agent registry
- A2A agent interoperability
- GraphRAG / knowledge graphs
- Cost and latency optimization
- Customer-cloud / self-hosted deployment

---

## Project Positioning

This project demonstrates practical experience across:

- Enterprise Generative AI architecture
- Agentic AI
- AI transformation
- AI reliability and evaluation
- Human-in-the-loop AI
- AI governance
- RAG
- Enterprise API integration
- AI platform deployment
- Production hardening
- AI solution architecture

It was designed as an end-to-end demonstration of taking an AI concept from **agent workflow → enterprise integration → reliability testing → governance → deployment**.

---

## Release

**Current Version:** V0.9  
**Status:** Controlled-Pilot / Portfolio Release