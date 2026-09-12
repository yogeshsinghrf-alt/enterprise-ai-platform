from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import inspect, text

from backend.app.db.database import Base, engine
from backend.app.db import models



def inspect_database() -> None:
    print("=== DATABASE SCHEMA INSPECTION ===")

    inspector = inspect(engine)

    tables = sorted(inspector.get_table_names())

    print(
        "alembic_version table:",
        "present" if "alembic_version" in tables else "missing",
    )

    print(
        "test_suite_runs table:",
        "present" if "test_suite_runs" in tables else "missing",
    )

    if "alembic_version" in tables:
        with engine.connect() as connection:
            revision = connection.execute(
                text(
                    "SELECT version_num "
                    "FROM alembic_version "
                    "LIMIT 1"
                )
            ).scalar()

        print(
            "Alembic revision:",
            revision or "none",
        )
    else:
        print(
            "Alembic revision: none"
        )

    if "test_suite_runs" in tables:
        columns = inspector.get_columns(
            "test_suite_runs"
        )

        pass_rate_column = next(
            (
                column
                for column in columns
                if column["name"] == "pass_rate"
            ),
            None,
        )

        if pass_rate_column:
            print(
                "pass_rate type:",
                str(pass_rate_column["type"]),
            )
        else:
            print(
                "pass_rate column: missing"
            )

    print(
        "Application tables:",
        ", ".join(tables),
    )
    with engine.connect() as connection:
        migration_context = MigrationContext.configure(
            connection,
            opts={
                "compare_type": True,
            },
        )

        differences = compare_metadata(
            migration_context,
            Base.metadata,
        )

    print(
        "Schema differences:",
        differences if differences else "none",
    )
    print("=== INSPECTION COMPLETE ===")


if __name__ == "__main__":
    inspect_database()