"""
Test configuration for Plutus backend tests.

Uses a dedicated `plutus_test` PostgreSQL database.
Before running tests for the first time, create the database:
    psql -U postgres -c "CREATE DATABASE plutus_test;"

Tables are created automatically via Base.metadata.create_all().
Each test runs inside a transaction that is rolled back at teardown
to keep tests isolated without requiring a full schema drop/recreate.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from fastapi.testclient import TestClient

# Override DATABASE_URL before importing app modules that load settings at import time
import os
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://postgres:Xaf1234321@localhost:5432/plutus_test",
)
os.environ.setdefault("SECRET_KEY", "J8xP4nQ7vLm2Kc9RzT5wYh3FsD1eUa6N")
os.environ.setdefault("REFRESH_SECRET_KEY", "V9mB2qX8rKd4Lp7ZcN5tHw1YsE3fJu0G")
os.environ.setdefault("INVITE_CODE", "plutus2024")
os.environ.setdefault("ALLOWED_ORIGINS", "http://localhost:5173")

from app.core.database import Base, get_db  # noqa: E402 — must come after env setup
from app.main import app  # noqa: E402

TEST_DB_URL = "postgresql://postgres:Xaf1234321@localhost:5432/plutus_test"

engine = create_engine(TEST_DB_URL)

# Create all tables once (idempotent — checkfirst avoids errors on existing tables)
Base.metadata.create_all(bind=engine, checkfirst=True)


# ---------------------------------------------------------------------------
# DB fixture — transaction-per-test with rollback for isolation
# ---------------------------------------------------------------------------

@pytest.fixture()
def db():
    """
    Yield a DB Session connected to a transaction that rolls back after each test.
    Uses SQLAlchemy 2.x-compatible approach: Session is created directly from a
    connection that has an open transaction.
    """
    connection = engine.connect()
    transaction = connection.begin()
    # Bind the session to the open connection so all queries share the transaction
    session = Session(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


# ---------------------------------------------------------------------------
# FastAPI TestClient fixture
# ---------------------------------------------------------------------------

@pytest.fixture()
def client(db):
    """TestClient with the real DB dependency overridden by the test session."""

    def override_get_db():
        try:
            yield db
        finally:
            pass  # session lifecycle handled by `db` fixture

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_db, None)


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def _register_and_login(client: TestClient, email: str = "test@example.com") -> dict:
    """Register a user and return auth headers."""
    client.post(
        "/api/auth/register",
        json={
            "name": "Test User",
            "email": email,
            "password": "password1",
            "invite_code": "plutus2024",
        },
    )
    resp = client.post(
        "/api/auth/login",
        json={"email": email, "password": "password1"},
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def auth_headers(client: TestClient) -> dict:
    """Fixture that returns auth headers for a freshly registered test user."""
    return _register_and_login(client)
