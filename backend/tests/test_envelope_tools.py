"""Unit tests for the agent tools: make_get_envelope_assignments and make_set_envelope.

These tests call the tool closures directly (no HTTP layer) so they can assert
on the returned strings and session_store state in isolation.

DB setup mirrors conftest.py: each test runs inside a rolled-back transaction.
Seeding helpers are copied from test_envelopes.py to keep the file self-contained.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.models.category import Category
from app.models.account import Account
from app.models.credit_card import CreditCard
from app.agents.tools.get_envelope_assignments import make_get_envelope_assignments
from app.agents.tools.set_envelope import make_set_envelope
from app.agents import session_store as session_store_module


# ---------------------------------------------------------------------------
# Seeding helpers (same as test_envelopes.py)
# ---------------------------------------------------------------------------

def _seed_user(client: TestClient, email: str = "tooltest@example.com") -> tuple[uuid.UUID, dict]:
    """Register + login a fresh user; return (user_id, auth_headers)."""
    client.post(
        "/api/auth/register",
        json={
            "name": "Tool Test User",
            "email": email,
            "password": "password1",
            "invite_code": "plutus2024",
        },
    )
    resp = client.post("/api/auth/login", json={"email": email, "password": "password1"})
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/api/auth/me", headers=headers)
    return uuid.UUID(me.json()["id"]), headers


def _seed_category(db, user_id=None, name="Groceries") -> Category:
    cat = Category(
        id=uuid.uuid4(),
        user_id=user_id,
        name=name,
        type="expense",
        is_default=(user_id is None),
    )
    db.add(cat)
    db.commit()
    return cat


def _seed_account(db, user_id: uuid.UUID, name="HDFC Savings") -> Account:
    acc = Account(
        id=uuid.uuid4(),
        user_id=user_id,
        name=name,
        type="savings",
        bank_name="HDFC",
    )
    db.add(acc)
    db.commit()
    return acc


def _seed_credit_card(db, user_id: uuid.UUID, name="Axis Credit Card") -> CreditCard:
    cc = CreditCard(
        id=uuid.uuid4(),
        user_id=user_id,
        name=name,
        bank_name="Axis",
        credit_limit=100000,
        billing_cycle_day=1,
        due_day=15,
    )
    db.add(cc)
    db.commit()
    return cc


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def user_id_and_db(client, db):
    """Return (user_id, db) for a freshly-registered test user."""
    uid, _ = _seed_user(client)
    return uid, db


@pytest.fixture()
def session_key():
    return f"test-session-{uuid.uuid4()}"


# ---------------------------------------------------------------------------
# get_envelope_assignments tests
# ---------------------------------------------------------------------------

def test_get_envelope_assignments_empty(user_id_and_db):
    """No envelopes in DB → returns a helpful message mentioning 'No envelope'."""
    user_id, db = user_id_and_db
    tool = make_get_envelope_assignments(user_id, db)
    result = tool()
    assert isinstance(result, str)
    assert "No envelope" in result, f"Expected 'No envelope' in result, got: {result!r}"


def test_get_envelope_assignments_with_data(user_id_and_db):
    """One envelope seeded via API → tool returns formatted category → account line."""
    user_id, db = user_id_and_db
    cat = _seed_category(db, user_id=user_id, name="Food")
    acc = _seed_account(db, user_id=user_id, name="HDFC Savings")

    # Create the envelope directly via service (same transaction / db session)
    from app.services import envelope_service
    envelope_service.upsert_envelope(cat.id, acc.id, None, user_id, db)

    tool = make_get_envelope_assignments(user_id, db)
    result = tool()

    assert isinstance(result, str)
    assert "Food" in result
    assert "HDFC Savings" in result
    assert "→" in result


def test_get_envelope_assignments_with_credit_card(user_id_and_db):
    """Envelope assigned to a credit card → tool shows cc name, not 'Unknown'."""
    user_id, db = user_id_and_db
    cat = _seed_category(db, user_id=user_id, name="Travel")
    cc = _seed_credit_card(db, user_id=user_id, name="Axis Credit Card")

    from app.services import envelope_service
    envelope_service.upsert_envelope(cat.id, None, cc.id, user_id, db)

    tool = make_get_envelope_assignments(user_id, db)
    result = tool()

    assert "Travel" in result
    assert "Axis Credit Card" in result
    assert "Unknown" not in result


# ---------------------------------------------------------------------------
# set_envelope tests
# ---------------------------------------------------------------------------

def test_set_envelope_missing_destination(user_id_and_db, session_key):
    """No account_name and no credit_card_name → error string, no exception."""
    user_id, db = user_id_and_db
    _seed_category(db, user_id=user_id, name="Rent")

    tool = make_set_envelope(user_id, db, session_key)
    result = tool(category_name="Rent")  # both optional args omitted

    assert isinstance(result, str)
    # Must be an error string, not a confirmation
    assert "Please specify" in result or "account" in result.lower()


def test_set_envelope_unknown_category(user_id_and_db, session_key):
    """Category name that matches nothing → returns error string, no exception."""
    user_id, db = user_id_and_db
    _seed_account(db, user_id=user_id, name="HDFC Savings")

    tool = make_set_envelope(user_id, db, session_key)
    result = tool(category_name="NonExistentXYZ", account_name="HDFC Savings")

    assert isinstance(result, str)
    assert "not found" in result.lower() or "error" in result.lower()


def test_set_envelope_success(user_id_and_db, session_key):
    """Valid call → returns confirmation string with category and account name."""
    user_id, db = user_id_and_db
    _seed_category(db, user_id=user_id, name="Groceries")
    _seed_account(db, user_id=user_id, name="HDFC Savings")

    tool = make_set_envelope(user_id, db, session_key)
    result = tool(category_name="Groceries", account_name="HDFC Savings")

    assert isinstance(result, str)
    assert "Groceries" in result
    assert "HDFC Savings" in result
    # Should be a confirmation, not an error
    assert "not found" not in result.lower()
    assert "error" not in result.lower()


def test_set_envelope_success_with_credit_card(user_id_and_db, session_key):
    """Valid call using credit_card_name → returns confirmation with cc name."""
    user_id, db = user_id_and_db
    _seed_category(db, user_id=user_id, name="Dining")
    _seed_credit_card(db, user_id=user_id, name="Axis Credit Card")

    tool = make_set_envelope(user_id, db, session_key)
    result = tool(category_name="Dining", credit_card_name="Axis Credit Card")

    assert isinstance(result, str)
    assert "Dining" in result
    assert "Axis Credit Card" in result
    assert "error" not in result.lower()


def test_set_envelope_stores_action(user_id_and_db, session_key):
    """After successful call, session_store contains action with type 'envelope_set'."""
    user_id, db = user_id_and_db
    _seed_category(db, user_id=user_id, name="Transport")
    _seed_account(db, user_id=user_id, name="HDFC Savings")

    tool = make_set_envelope(user_id, db, session_key)
    result = tool(category_name="Transport", account_name="HDFC Savings")

    assert "error" not in result.lower()

    action = session_store_module.session_store.get_last_action(session_key)
    assert action is not None
    assert action["type"] == "envelope_set"
    assert action["resource_type"] == "envelope"
    assert "undo_data" in action


def test_set_envelope_undo_data_when_no_previous(user_id_and_db, session_key):
    """First-time set → undo_data has was_empty=True so undo knows to delete."""
    user_id, db = user_id_and_db
    _seed_category(db, user_id=user_id, name="Utilities")
    _seed_account(db, user_id=user_id, name="HDFC Savings")

    tool = make_set_envelope(user_id, db, session_key)
    tool(category_name="Utilities", account_name="HDFC Savings")

    action = session_store_module.session_store.get_last_action(session_key)
    undo_data = action["undo_data"]
    assert undo_data.get("was_empty") is True
    # account_id and credit_card_id should NOT be in undo_data (nothing to restore)
    assert "account_id" not in undo_data
    assert "credit_card_id" not in undo_data


def test_set_envelope_undo_data_when_previous_exists(user_id_and_db, session_key):
    """Second set on the same category → undo_data preserves the first account_id."""
    user_id, db = user_id_and_db
    _seed_category(db, user_id=user_id, name="Shopping")
    acc1 = _seed_account(db, user_id=user_id, name="SBI Account")
    acc2 = _seed_account(db, user_id=user_id, name="HDFC Savings")

    tool = make_set_envelope(user_id, db, session_key)

    # First set
    tool(category_name="Shopping", account_name="SBI Account")
    first_action = session_store_module.session_store.get_last_action(session_key)
    # First action's undo_data should have was_empty=True (no prior envelope)
    assert first_action["undo_data"].get("was_empty") is True

    # Second set — overwrite with different account
    tool(category_name="Shopping", account_name="HDFC Savings")
    second_action = session_store_module.session_store.get_last_action(session_key)
    undo_data = second_action["undo_data"]

    # undo_data must have the previous account_id (acc1.id) so we can restore it
    assert "account_id" in undo_data
    assert undo_data["account_id"] == str(acc1.id)
    assert "was_empty" not in undo_data


def test_set_envelope_global_category_resolved(user_id_and_db, session_key):
    """Category with user_id=None (global default) is still found and usable."""
    user_id, db = user_id_and_db
    _seed_category(db, user_id=None, name="Healthcare")  # global category
    _seed_account(db, user_id=user_id, name="HDFC Savings")

    tool = make_set_envelope(user_id, db, session_key)
    result = tool(category_name="Healthcare", account_name="HDFC Savings")

    assert "Healthcare" in result
    assert "HDFC Savings" in result
    assert "not found" not in result.lower()


def test_set_envelope_account_scoped_to_user(user_id_and_db, session_key, client, db):
    """Account belonging to another user is NOT resolved → returns not-found error."""
    user_id, db = user_id_and_db

    # Create a second user and seed an account under them
    other_uid, _ = _seed_user(client, email="other_tool@example.com")
    _seed_account(db, user_id=other_uid, name="Other User Account")
    _seed_category(db, user_id=user_id, name="Fuel")

    tool = make_set_envelope(user_id, db, session_key)
    result = tool(category_name="Fuel", account_name="Other User Account")

    # Must return not-found, not succeed
    assert "not found" in result.lower()
