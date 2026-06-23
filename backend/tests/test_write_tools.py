"""Unit tests for the 7 AI agent write tools (Phase 3).

Tests call the tool closures directly — no HTTP layer.
DB setup mirrors conftest.py: each test runs inside a rolled-back transaction.
"""

import uuid
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.models.account import Account
from app.models.budget import Budget
from app.models.category import Category
from app.models.credit_card import CreditCard
from app.models.transaction import Transaction
from app.agents.tools.add_transaction import make_add_transaction
from app.agents.tools.edit_transaction import make_edit_transaction
from app.agents.tools.delete_transaction import make_delete_transaction
from app.agents.tools.add_budget import make_add_budget
from app.agents.tools.edit_budget import make_edit_budget
from app.agents.tools.add_account import make_add_account
from app.agents.tools.edit_account import make_edit_account
from app.agents import session_store as session_store_module


# ---------------------------------------------------------------------------
# Seed helpers
# ---------------------------------------------------------------------------

def _seed_user(client: TestClient, email: str = "writetools@example.com") -> tuple[uuid.UUID, dict]:
    client.post(
        "/api/auth/register",
        json={
            "name": "Write Tools User",
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


def _seed_category(db, user_id=None, name="Groceries", cat_type="expense") -> Category:
    cat = Category(
        id=uuid.uuid4(),
        user_id=user_id,
        name=name,
        type=cat_type,
        is_default=(user_id is None),
    )
    db.add(cat)
    db.flush()
    return cat


def _seed_account(db, user_id: uuid.UUID, name="HDFC Savings", bank_name="HDFC") -> Account:
    acc = Account(
        id=uuid.uuid4(),
        user_id=user_id,
        name=name,
        type="savings",
        bank_name=bank_name,
        balance=Decimal("10000"),
    )
    db.add(acc)
    db.flush()
    return acc


def _seed_credit_card(db, user_id: uuid.UUID, name="Axis CC") -> CreditCard:
    cc = CreditCard(
        id=uuid.uuid4(),
        user_id=user_id,
        name=name,
        bank_name="Axis",
        credit_limit=Decimal("100000"),
        current_outstanding=Decimal("0"),
        available_limit=Decimal("100000"),
        billing_cycle_day=1,
        due_day=15,
    )
    db.add(cc)
    db.flush()
    return cc


def _seed_transaction(db, user_id: uuid.UUID, category_id: uuid.UUID,
                       account_id=None, amount=500, notes="lunch", tx_type="expense") -> Transaction:
    tx = Transaction(
        id=uuid.uuid4(),
        user_id=user_id,
        category_id=category_id,
        account_id=account_id,
        amount=Decimal(str(amount)),
        type=tx_type,
        date=date.today(),
        notes=notes,
        tags=[],
        is_recurring=False,
    )
    db.add(tx)
    db.flush()
    return tx


def _seed_budget(db, user_id: uuid.UUID, category_id: uuid.UUID,
                  amount=5000, period="monthly") -> Budget:
    budget = Budget(
        id=uuid.uuid4(),
        user_id=user_id,
        category_id=category_id,
        amount=Decimal(str(amount)),
        period=period,
        start_date=date.today().replace(day=1),
    )
    db.add(budget)
    db.flush()
    return budget


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def user_setup(client, db):
    """Register a user and return (user_id, db)."""
    uid, _ = _seed_user(client)
    return uid, db


@pytest.fixture()
def session_key():
    return f"test-session-{uuid.uuid4()}"


# ---------------------------------------------------------------------------
# add_transaction tests
# ---------------------------------------------------------------------------

def test_add_expense_transaction(user_setup, session_key):
    """Valid expense with category + account → returns success string, action stored."""
    user_id, db = user_setup
    cat = _seed_category(db, user_id=user_id, name="Food")
    acc = _seed_account(db, user_id=user_id, name="HDFC Savings")

    tool = make_add_transaction(user_id, db, session_key)
    result = tool(
        type="expense",
        amount=250.0,
        category_name="Food",
        account_name="HDFC Savings",
        date=str(date.today()),
    )

    assert isinstance(result, str)
    assert "250" in result or "expense" in result.lower()
    assert "error" not in result.lower()
    assert "failed" not in result.lower()

    action = session_store_module.session_store.get_last_action(session_key)
    assert action is not None
    assert action["type"] == "transaction_created"
    assert action["resource_type"] == "transaction"
    assert action["resource_id"]
    assert action["undo_data"] == {}


def test_add_transaction_unknown_category(user_setup, session_key):
    """Unknown category name → returns error string, no exception."""
    user_id, db = user_setup
    _seed_account(db, user_id=user_id, name="HDFC Savings")

    tool = make_add_transaction(user_id, db, session_key)
    result = tool(type="expense", amount=100.0, category_name="NonExistentXYZ")

    assert isinstance(result, str)
    assert "not found" in result.lower() or "category" in result.lower()
    # Must NOT store an action since it failed early
    action = session_store_module.session_store.get_last_action(session_key)
    assert action is None


def test_add_transaction_unknown_account(user_setup, session_key):
    """Unknown account name → returns error string, no exception."""
    user_id, db = user_setup
    _seed_category(db, user_id=user_id, name="Food")

    tool = make_add_transaction(user_id, db, session_key)
    result = tool(
        type="expense",
        amount=100.0,
        category_name="Food",
        account_name="NonExistentBank",
    )

    assert isinstance(result, str)
    assert "not found" in result.lower() or "account" in result.lower()


def test_add_transaction_envelope_deviation(user_setup, session_key):
    """Envelope expects HDFC but ICICI used → result contains ENVELOPE_DEVIATION."""
    user_id, db = user_setup
    cat = _seed_category(db, user_id=user_id, name="Groceries")
    hdfc = _seed_account(db, user_id=user_id, name="HDFC Savings")
    icici = _seed_account(db, user_id=user_id, name="ICICI Savings", bank_name="ICICI")

    # Set envelope to expect HDFC
    from app.services import envelope_service
    envelope_service.upsert_envelope(cat.id, hdfc.id, None, user_id, db)

    tool = make_add_transaction(user_id, db, session_key)
    # Use ICICI instead
    result = tool(
        type="expense",
        amount=300.0,
        category_name="Groceries",
        account_name="ICICI Savings",
        date=str(date.today()),
    )

    assert isinstance(result, str)
    assert "ENVELOPE_DEVIATION" in result
    assert "HDFC" in result
    assert "ICICI" in result


def test_add_transaction_invalid_date_returns_error(user_setup, session_key):
    """Invalid date string → tool catches the ValueError and returns error string."""
    user_id, db = user_setup
    _seed_category(db, user_id=user_id, name="Food")

    tool = make_add_transaction(user_id, db, session_key)
    result = tool(type="expense", amount=100.0, category_name="Food", date="not-a-date")

    assert isinstance(result, str)
    assert "failed" in result.lower() or "error" in result.lower() or "invalid" in result.lower()


def test_add_transaction_global_category_resolved(user_setup, session_key):
    """Global category (user_id=None) is found for any user."""
    user_id, db = user_setup
    _seed_category(db, user_id=None, name="Healthcare")  # global
    acc = _seed_account(db, user_id=user_id, name="SBI Savings", bank_name="SBI")

    tool = make_add_transaction(user_id, db, session_key)
    result = tool(
        type="expense",
        amount=500.0,
        category_name="Healthcare",
        account_name="SBI Savings",
    )

    assert isinstance(result, str)
    assert "Healthcare" in result
    assert "failed" not in result.lower()


# ---------------------------------------------------------------------------
# edit_transaction tests
# ---------------------------------------------------------------------------

def test_edit_transaction_found(user_setup, session_key):
    """Matching transaction updated; action stored with old values in undo_data."""
    user_id, db = user_setup
    cat = _seed_category(db, user_id=user_id, name="Food")
    acc = _seed_account(db, user_id=user_id, name="HDFC Savings")
    tx = _seed_transaction(db, user_id, cat.id, account_id=acc.id, notes="dinner out", amount=400)

    tool = make_edit_transaction(user_id, db, session_key)
    result = tool(description="dinner out", amount=500.0)

    assert isinstance(result, str)
    assert "500" in result or "Updated" in result
    assert "failed" not in result.lower()

    action = session_store_module.session_store.get_last_action(session_key)
    assert action is not None
    assert action["type"] == "transaction_updated"
    assert action["resource_type"] == "transaction"
    # undo_data must include old amount
    undo = action["undo_data"]
    assert "amount" in undo
    assert undo["amount"] == "400"  # old value as string
    assert "category_id" in undo
    assert "date" in undo


def test_edit_transaction_not_found(user_setup, session_key):
    """No matching transaction → returns 'No transaction' error string."""
    user_id, db = user_setup

    tool = make_edit_transaction(user_id, db, session_key)
    result = tool(description="completely nonexistent xyz123")

    assert isinstance(result, str)
    assert "no transaction" in result.lower() or "not found" in result.lower()


def test_edit_transaction_disambiguation(user_setup, session_key):
    """2+ matching transactions → returns disambiguation list, does not update."""
    user_id, db = user_setup
    cat = _seed_category(db, user_id=user_id, name="Transport")
    _seed_transaction(db, user_id, cat.id, notes="uber ride", amount=150)
    _seed_transaction(db, user_id, cat.id, notes="uber ride", amount=200)

    tool = make_edit_transaction(user_id, db, session_key)
    result = tool(description="uber ride", amount=999.0)

    assert isinstance(result, str)
    assert "multiple" in result.lower() or "specific" in result.lower()
    # No action stored because nothing was actually updated
    action = session_store_module.session_store.get_last_action(session_key)
    assert action is None


# ---------------------------------------------------------------------------
# delete_transaction tests
# ---------------------------------------------------------------------------

def test_delete_transaction_found(user_setup, session_key):
    """Transaction deleted; undo_data has full snapshot including tags and is_recurring."""
    user_id, db = user_setup
    cat = _seed_category(db, user_id=user_id, name="Utilities")
    tx = _seed_transaction(db, user_id, cat.id, notes="electricity bill", amount=1200)

    tool = make_delete_transaction(user_id, db, session_key)
    result = tool(description="electricity bill")

    assert isinstance(result, str)
    assert "1,200" in result or "1200" in result
    assert "failed" not in result.lower()

    action = session_store_module.session_store.get_last_action(session_key)
    assert action is not None
    assert action["type"] == "transaction_deleted"
    assert action["resource_type"] == "transaction"

    undo = action["undo_data"]
    # Must contain all fields needed to recreate the transaction
    assert "amount" in undo
    assert "type" in undo
    assert "date" in undo
    assert "category_id" in undo
    assert "tags" in undo
    assert "is_recurring" in undo
    # tags should be a list, not None
    assert isinstance(undo["tags"], list)


def test_delete_transaction_not_found(user_setup, session_key):
    """No matching transaction → returns error string."""
    user_id, db = user_setup

    tool = make_delete_transaction(user_id, db, session_key)
    result = tool(description="nonexistent transaction xyz")

    assert isinstance(result, str)
    assert "no matching" in result.lower() or "not found" in result.lower()


def test_delete_transaction_disambiguation(user_setup, session_key):
    """Multiple matches → returns disambiguation list without deleting anything."""
    user_id, db = user_setup
    cat = _seed_category(db, user_id=user_id, name="Shopping")
    _seed_transaction(db, user_id, cat.id, notes="amazon order", amount=500)
    _seed_transaction(db, user_id, cat.id, notes="amazon order", amount=800)

    tool = make_delete_transaction(user_id, db, session_key)
    result = tool(description="amazon order")

    assert isinstance(result, str)
    assert "multiple" in result.lower() or "specific" in result.lower()
    # No action stored
    action = session_store_module.session_store.get_last_action(session_key)
    assert action is None


# ---------------------------------------------------------------------------
# add_budget tests
# ---------------------------------------------------------------------------

def test_add_budget(user_setup, session_key):
    """Budget created for category; action stored with correct resource_type."""
    user_id, db = user_setup
    _seed_category(db, user_id=user_id, name="Groceries")

    tool = make_add_budget(user_id, db, session_key)
    result = tool(category_name="Groceries", amount=3000.0, period="monthly")

    assert isinstance(result, str)
    assert "3,000" in result or "3000" in result
    assert "Groceries" in result
    assert "failed" not in result.lower()

    action = session_store_module.session_store.get_last_action(session_key)
    assert action is not None
    assert action["type"] == "budget_created"
    assert action["resource_type"] == "budget"
    assert action["undo_data"] == {}


def test_add_budget_unknown_category(user_setup, session_key):
    """Unknown category → returns error string, no exception."""
    user_id, db = user_setup

    tool = make_add_budget(user_id, db, session_key)
    result = tool(category_name="DoesNotExist", amount=1000.0)

    assert isinstance(result, str)
    assert "not found" in result.lower() or "category" in result.lower()


def test_add_budget_invalid_period_defaults_to_monthly(user_setup, session_key):
    """Garbage period value → silently defaults to 'monthly', still succeeds."""
    user_id, db = user_setup
    _seed_category(db, user_id=user_id, name="Entertainment")

    tool = make_add_budget(user_id, db, session_key)
    result = tool(category_name="Entertainment", amount=500.0, period="daily")

    assert isinstance(result, str)
    assert "failed" not in result.lower()
    # Period is normalised; result should include 'month' (monthly → month)
    assert "month" in result.lower()


def test_edit_budget_not_found(user_setup, session_key):
    """Category exists but has no budget → returns error string."""
    user_id, db = user_setup
    _seed_category(db, user_id=user_id, name="Travel")

    tool = make_edit_budget(user_id, db, session_key)
    result = tool(category_name="Travel", amount=2000.0)

    assert isinstance(result, str)
    assert "no budget" in result.lower() or "not found" in result.lower()


def test_edit_budget_found(user_setup, session_key):
    """Existing budget updated; snapshot stored in undo_data before update."""
    user_id, db = user_setup
    cat = _seed_category(db, user_id=user_id, name="Dining")
    _seed_budget(db, user_id, cat.id, amount=2000, period="monthly")

    tool = make_edit_budget(user_id, db, session_key)
    result = tool(category_name="Dining", amount=3000.0)

    assert isinstance(result, str)
    assert "3,000" in result or "3000" in result
    assert "failed" not in result.lower()

    action = session_store_module.session_store.get_last_action(session_key)
    assert action is not None
    assert action["type"] == "budget_updated"
    undo = action["undo_data"]
    assert undo["amount"] == "2000"  # old value
    assert undo["period"] == "monthly"


# ---------------------------------------------------------------------------
# add_account tests
# ---------------------------------------------------------------------------

def test_add_account(user_setup, session_key):
    """Account created with correct type and Decimal balance; action stored."""
    user_id, db = user_setup

    tool = make_add_account(user_id, db, session_key)
    result = tool(
        name="HDFC Salary",
        bank_name="HDFC Bank",
        account_type="savings",
        balance=50000.0,
    )

    assert isinstance(result, str)
    assert "HDFC Salary" in result
    assert "50,000" in result or "50000" in result
    assert "failed" not in result.lower()

    action = session_store_module.session_store.get_last_action(session_key)
    assert action is not None
    assert action["type"] == "account_created"
    assert action["resource_type"] == "account"
    assert action["undo_data"] == {}


def test_add_account_invalid_type_defaults_to_savings(user_setup, session_key):
    """Invalid account_type silently defaults to 'savings'."""
    user_id, db = user_setup

    tool = make_add_account(user_id, db, session_key)
    result = tool(name="SBI Business", bank_name="SBI", account_type="business")

    assert isinstance(result, str)
    assert "savings" in result.lower()
    assert "failed" not in result.lower()


def test_add_account_zero_balance(user_setup, session_key):
    """Account with default (zero) balance creates successfully."""
    user_id, db = user_setup

    tool = make_add_account(user_id, db, session_key)
    result = tool(name="ICICI Zero", bank_name="ICICI Bank")

    assert isinstance(result, str)
    assert "ICICI Zero" in result
    assert "failed" not in result.lower()


# ---------------------------------------------------------------------------
# edit_account tests
# ---------------------------------------------------------------------------

def test_edit_account_not_found(user_setup, session_key):
    """Account not found → returns error string, no exception."""
    user_id, db = user_setup

    tool = make_edit_account(user_id, db, session_key)
    result = tool(account_name="NonExistentBankXYZ", new_name="Renamed")

    assert isinstance(result, str)
    assert "not found" in result.lower() or "account" in result.lower()


def test_edit_account_rename(user_setup, session_key):
    """Rename account via new_name → success, snapshot in undo_data."""
    user_id, db = user_setup
    _seed_account(db, user_id, name="Old Name", bank_name="HDFC")

    tool = make_edit_account(user_id, db, session_key)
    result = tool(account_name="Old Name", new_name="New Name")

    assert isinstance(result, str)
    assert "New Name" in result or "name" in result.lower()
    assert "failed" not in result.lower()

    action = session_store_module.session_store.get_last_action(session_key)
    assert action is not None
    assert action["type"] == "account_updated"
    undo = action["undo_data"]
    assert undo["name"] == "Old Name"
    assert "balance" in undo
    assert "bank_name" in undo


def test_edit_account_no_changes_returns_message(user_setup, session_key):
    """Calling edit_account with no fields to change → returns informative string."""
    user_id, db = user_setup
    _seed_account(db, user_id, name="My Account")

    tool = make_edit_account(user_id, db, session_key)
    result = tool(account_name="My Account")  # no new_name, balance, or bank_name

    assert isinstance(result, str)
    assert "no changes" in result.lower()


def test_edit_account_scoped_to_user(user_setup, session_key, client, db):
    """Account belonging to another user is NOT found → returns not-found error."""
    user_id, db = user_setup

    other_uid, _ = _seed_user(client, email="other_writetools@example.com")
    _seed_account(db, other_uid, name="Other User Account")

    tool = make_edit_account(user_id, db, session_key)
    result = tool(account_name="Other User Account", new_name="Hijacked")

    assert "not found" in result.lower()
