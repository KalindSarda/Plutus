"""Envelope budgeting endpoint tests.

Tests cover the POST /api/envelopes (upsert), GET /api/envelopes (list),
and DELETE /api/envelopes/{category_id} endpoints.

Seeding helpers create the minimum DB objects required without going through
the full API, matching the pattern used in test_categories.py.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.models.category import Category
from app.models.account import Account
from app.models.credit_card import CreditCard


# ---------------------------------------------------------------------------
# Seeding helpers
# ---------------------------------------------------------------------------

def _seed_category(db, user_id=None, name="Groceries") -> Category:
    """Insert a category owned by `user_id` (None = global default)."""
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


def _seed_account(db, user_id: uuid.UUID, name="Checking") -> Account:
    """Insert an account owned by `user_id`."""
    acc = Account(
        id=uuid.uuid4(),
        user_id=user_id,
        name=name,
        type="checking",
        bank_name="Test Bank",
    )
    db.add(acc)
    db.commit()
    return acc


def _seed_credit_card(db, user_id: uuid.UUID, name="Visa") -> CreditCard:
    """Insert a credit card owned by `user_id`."""
    cc = CreditCard(
        id=uuid.uuid4(),
        user_id=user_id,
        name=name,
        bank_name="Test Bank",
        credit_limit=5000,
        billing_cycle_day=1,
        due_day=15,
    )
    db.add(cc)
    db.commit()
    return cc


def _get_user_id(client: TestClient, auth_headers: dict) -> uuid.UUID:
    """Return the UUID of the currently authenticated user."""
    resp = client.get("/api/auth/me", headers=auth_headers)
    return uuid.UUID(resp.json()["id"])


def _register_and_login_extra(client: TestClient, email: str) -> dict:
    """Register a second user and return their auth headers."""
    client.post(
        "/api/auth/register",
        json={
            "name": "Other User",
            "email": email,
            "password": "password2",
            "invite_code": "plutus2024",
        },
    )
    resp = client.post(
        "/api/auth/login",
        json={"email": email, "password": "password2"},
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_list_envelopes_empty(client, auth_headers):
    """GET /api/envelopes returns an empty list for a brand-new user."""
    resp = client.get("/api/envelopes", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_upsert_envelope_with_account(client, auth_headers, db):
    """POST creates an envelope linking a category to an account; GET returns it."""
    user_id = _get_user_id(client, auth_headers)
    category = _seed_category(db, user_id=user_id, name="Rent")
    account = _seed_account(db, user_id=user_id)

    resp = client.post(
        "/api/envelopes",
        json={"category_id": str(category.id), "account_id": str(account.id)},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.json()
    data = resp.json()
    assert data["category_id"] == str(category.id)
    assert data["account_id"] == str(account.id)
    assert data["category_name"] == "Rent"
    assert data["account_name"] == "Checking"
    assert data["credit_card_id"] is None
    assert data["cc_name"] is None

    # Verify GET also returns it
    list_resp = client.get("/api/envelopes", headers=auth_headers)
    assert list_resp.status_code == 200
    envelopes = list_resp.json()
    assert len(envelopes) == 1
    assert envelopes[0]["category_id"] == str(category.id)


def test_upsert_envelope_updates_existing(client, auth_headers, db):
    """POST the same category_id twice performs an upsert — no duplicate row."""
    user_id = _get_user_id(client, auth_headers)
    category = _seed_category(db, user_id=user_id, name="Utilities")
    account1 = _seed_account(db, user_id=user_id, name="Savings")
    account2 = _seed_account(db, user_id=user_id, name="Checking")

    # First upsert
    r1 = client.post(
        "/api/envelopes",
        json={"category_id": str(category.id), "account_id": str(account1.id)},
        headers=auth_headers,
    )
    assert r1.status_code == 200
    first_id = r1.json()["id"]

    # Second upsert — same category, different account
    r2 = client.post(
        "/api/envelopes",
        json={"category_id": str(category.id), "account_id": str(account2.id)},
        headers=auth_headers,
    )
    assert r2.status_code == 200
    second_id = r2.json()["id"]
    assert second_id == first_id, "Upsert must reuse the existing row, not create a new one"
    assert r2.json()["account_id"] == str(account2.id)

    # Confirm only one envelope in the list
    list_resp = client.get("/api/envelopes", headers=auth_headers)
    assert len(list_resp.json()) == 1


def test_upsert_envelope_with_credit_card(client, auth_headers, db):
    """POST with credit_card_id instead of account_id creates envelope correctly."""
    user_id = _get_user_id(client, auth_headers)
    category = _seed_category(db, user_id=user_id, name="Dining")
    cc = _seed_credit_card(db, user_id=user_id, name="Visa")

    resp = client.post(
        "/api/envelopes",
        json={"category_id": str(category.id), "credit_card_id": str(cc.id)},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.json()
    data = resp.json()
    assert data["credit_card_id"] == str(cc.id)
    assert data["cc_name"] == "Visa"
    assert data["account_id"] is None
    assert data["account_name"] is None


def test_delete_envelope(client, auth_headers, db):
    """DELETE removes the envelope; subsequent GET returns empty list."""
    user_id = _get_user_id(client, auth_headers)
    category = _seed_category(db, user_id=user_id, name="Transport")
    account = _seed_account(db, user_id=user_id)

    # Create it
    client.post(
        "/api/envelopes",
        json={"category_id": str(category.id), "account_id": str(account.id)},
        headers=auth_headers,
    )

    # Delete it
    del_resp = client.delete(f"/api/envelopes/{category.id}", headers=auth_headers)
    assert del_resp.status_code == 204

    # Confirm it's gone
    list_resp = client.get("/api/envelopes", headers=auth_headers)
    assert list_resp.json() == []


def test_delete_nonexistent_envelope(client, auth_headers):
    """DELETE for a category_id that has no envelope returns 404."""
    random_id = uuid.uuid4()
    resp = client.delete(f"/api/envelopes/{random_id}", headers=auth_headers)
    assert resp.status_code == 404


def test_envelope_isolation(client, auth_headers, db):
    """User B cannot see User A's envelopes (IDOR guard)."""
    # Set up user A's envelope
    user_a_id = _get_user_id(client, auth_headers)
    category = _seed_category(db, user_id=user_a_id, name="Insurance")
    account = _seed_account(db, user_id=user_a_id)

    client.post(
        "/api/envelopes",
        json={"category_id": str(category.id), "account_id": str(account.id)},
        headers=auth_headers,
    )

    # Register and login as user B
    user_b_headers = _register_and_login_extra(client, "userb_env@example.com")

    # User B should see an empty list
    resp = client.get("/api/envelopes", headers=user_b_headers)
    assert resp.status_code == 200
    assert resp.json() == [], "User B must not see User A's envelopes"


def test_envelope_isolation_delete(client, auth_headers, db):
    """User B cannot delete User A's envelope — must receive 404."""
    user_a_id = _get_user_id(client, auth_headers)
    category = _seed_category(db, user_id=user_a_id, name="Subscriptions")
    account = _seed_account(db, user_id=user_a_id)

    client.post(
        "/api/envelopes",
        json={"category_id": str(category.id), "account_id": str(account.id)},
        headers=auth_headers,
    )

    user_b_headers = _register_and_login_extra(client, "userb_env_del@example.com")
    resp = client.delete(f"/api/envelopes/{category.id}", headers=user_b_headers)
    # delete_envelope scopes by user_id so it will not find the row → 404
    assert resp.status_code == 404


def test_unauthenticated_access(client):
    """GET /api/envelopes without a token must return 401."""
    resp = client.get("/api/envelopes")
    assert resp.status_code == 401
