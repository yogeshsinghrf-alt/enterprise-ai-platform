from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, Integer, Float, String, Text,Boolean, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.database import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    chunks = relationship(
        "DocumentChunk",
        back_populates="document",
        cascade="all, delete-orphan",
    )


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    document_id: Mapped[int] = mapped_column(
        ForeignKey("documents.id"),
        nullable=False,
        index=True,
    )

    chunk_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    embedding: Mapped[list[float]] = mapped_column(
        Vector(3072),
        nullable=False,
    )

    document = relationship(
        "Document",
        back_populates="chunks",
    )
class ApprovalRequest(Base):
    __tablename__ = "approval_requests"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    approval_id: Mapped[str] = mapped_column(
        String(36),
        unique=True,
        nullable=False,
        index=True,
    )

    tool_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    arguments: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="{}",
    )

    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="pending",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    decided_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )
    executed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )
class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    event_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    approval_id: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
        index=True,
    )

    tool_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    details: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="{}",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )        
class AgentRun(Base):
    __tablename__ = "agent_runs"

    id = Column(Integer, primary_key=True, index=True)

    run_id = Column(
        String(36),
        unique=True,
        index=True,
        nullable=False,
    )

    task = Column(Text, nullable=False)

    selected_tool = Column(
        String(255),
        nullable=True,
    )

    tool_used = Column(
        Boolean,
        default=False,
        nullable=False,
    )

    model = Column(
        String(100),
        nullable=True,
    )

    status = Column(
        String(50),
        default="started",
        index=True,
        nullable=False,
    )

    evaluation_score = Column(
        Integer,
        nullable=True,
    )

    retry_count = Column(
        Integer,
        default=0,
        nullable=False,
    )

    approval_required = Column(
        Boolean,
        default=False,
        nullable=False,
    )

    approval_id = Column(
        String(36),
        nullable=True,
        index=True,
    )

    latency_ms = Column(
        Integer,
        nullable=True,
    )

    started_at = Column(
        DateTime,
        nullable=False,
    )

    completed_at = Column(
        DateTime,
        nullable=True,
    )  
class AgentTrace(Base):
    __tablename__ = "agent_traces"

    id = Column(Integer, primary_key=True, index=True)

    run_id = Column(
        String(36),
        index=True,
        nullable=False,
    )

    node_name = Column(
        String(100),
        index=True,
        nullable=False,
    )

    event_type = Column(
        String(100),
        index=True,
        nullable=False,
    )

    status = Column(
        String(50),
        index=True,
        nullable=False,
    )

    duration_ms = Column(
        Integer,
        nullable=True,
    )

    details = Column(
        Text,
        default="{}",
        nullable=False,
    )

    created_at = Column(
        DateTime,
        nullable=False,
    )      
class TestSuite(Base):
    __tablename__ = "test_suites"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    suite_id = Column(
        String(36),
        unique=True,
        index=True,
        nullable=False,
    )

    name = Column(
        String(255),
        nullable=False,
    )

    description = Column(
        Text,
        nullable=False,
        default="",
    )

    status = Column(
        String(50),
        nullable=False,
        default="draft",
        index=True,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    test_cases = relationship(
        "TestCase",
        back_populates="test_suite",
        cascade="all, delete-orphan",
    )


class TestCase(Base):
    __tablename__ = "test_cases"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    case_id = Column(
        String(36),
        unique=True,
        index=True,
        nullable=False,
    )

    test_suite_id = Column(
        Integer,
        ForeignKey("test_suites.id"),
        nullable=False,
        index=True,
    )

    name = Column(
        String(255),
        nullable=False,
    )

    input_prompt = Column(
        Text,
        nullable=False,
    )

    expected_tool = Column(
        String(255),
        nullable=True,
    )

    expected_approval_required = Column(
        Boolean,
        nullable=True,
    )

    min_evaluation_score = Column(
        Integer,
        nullable=True,
    )

    expected_response_contains = Column(
        Text,
        nullable=True,
    )

    enabled = Column(
        Boolean,
        nullable=False,
        default=True,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    test_suite = relationship(
        "TestSuite",
        back_populates="test_cases",
    )    
class EvaluationResult(Base):
    __tablename__ = "evaluation_results"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    evaluation_id = Column(
        String(36),
        unique=True,
        index=True,
        nullable=False,
    )

    case_id = Column(
        String(36),
        index=True,
        nullable=False,
    )

    suite_id = Column(
        String(36),
        index=True,
        nullable=True,
    )

    run_id = Column(
        String(36),
        index=True,
        nullable=False,
    )

    status = Column(
        String(50),
        index=True,
        nullable=False,
    )

    passed = Column(
        Boolean,
        nullable=False,
    )

    actual_tool = Column(
        String(255),
        nullable=True,
    )

    actual_approval_required = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    evaluation_score = Column(
        Integer,
        nullable=True,
    )
    evaluation_feedback = Column(
    Text,
    nullable=False,
    default="",
    )
    evaluation_feedback = Column(
    Text,
        nullable=False,
        default="",
    )
    checks = Column(
        Text,
        nullable=False,
        default="[]",
    )

    failed_checks = Column(
        Text,
        nullable=False,
        default="[]",
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )    
class TestSuiteRun(Base):
    __tablename__ = "test_suite_runs"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    suite_run_id = Column(
        String(36),
        unique=True,
        index=True,
        nullable=False,
    )

    suite_id = Column(
        String(36),
        index=True,
        nullable=False,
    )

    suite_name = Column(
        String(255),
        nullable=False,
    )

    status = Column(
        String(50),
        index=True,
        nullable=False,
        default="running",
    )

    total_tests = Column(
        Integer,
        nullable=False,
        default=0,
    )

    passed_tests = Column(
        Integer,
        nullable=False,
        default=0,
    )

    failed_tests = Column(
        Integer,
        nullable=False,
        default=0,
    )

    pass_rate = Column(
    Float,
    nullable=False,
    default=0.0,
    )

    started_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    completed_at = Column(
        DateTime,
        nullable=True,
    )    