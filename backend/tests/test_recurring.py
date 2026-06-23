"""Recurring template endpoint and service tests."""

import uuid
from datetime import date, timedelta
from decimal import Decimal

from app.models.category import Category
from app.models.transaction import Transaction


def _seed_category(db) -> Category:
    cat = Category(
        id=uuid.uuid4(),
        user_id=None,
        name="Utilities",
        type="expense",
        is_default=True,
    )
    db.add(cat)
    db.commit()
    return cat


def test_create_recurring_and_list_returns_it(client, auth_headers, db):
    """POST /api/recurring then GET should return the created template."""
    cat = _seed_category(db)
    next_due = str(date.today() + timedelta(days=7))

    create_resp = client.post(
        "/api/recurring",
        headers=auth_headers,
        json={
            "name": "Monthly Electricity",
            "amount": "120.00",
            "type": "expense",
            "category_id": str(cat.id),
            "frequency": "monthly",
            "next_due_date": next_due,
        },
    )
    assert create_resp.status_code == 201, create_resp.json()
    created = create_resp.json()
    assert created["name"] == "Monthly Electricity"
    assert created["is_active"] is True

    list_resp = client.get("/api/recurring", headers=auth_headers)
    assert list_resp.status_code == 200
    templates = list_resp.json()
    assert len(templates) == 1
    assert templates[0]["id"] == created["id"]


def test_apply_recurring_creates_transaction_and_advances_date(client, auth_headers, db):
    """POST /api/recurring/{id}/apply should create a transaction and advance next_due_date."""
    cat = _seed_category(db)
    due_date = date.today()

    create_resp = client.post(
        "/api/recurring",
        headers=auth_headers,
        json={
            "name": "Netflix",
            "amount": "15.99",
            "type": "expense",
            "category_id": str(cat.id),
            "frequency": "monthly",
            "next_due_date": str(due_date),
        },
    )
    assert create_resp.status_code == 201
    tmpl_id = create_resp.json()["id"]

    apply_resp = client.post(f"/api/recurring/{tmpl_id}/apply", headers=auth_headers)
    assert apply_resp.status_code == 201, apply_resp.json()
    tx = apply_resp.json()
    assert tx["is_recurring"] is True
    assert Decimal(tx["amount"]) == Decimal("15.99")

    # Verify next_due_date was advanced by one month
    list_resp = client.get("/api/recurring", headers=auth_headers)
    updated_tmpl = list_resp.json()[0]
    new_due = date.fromisoformat(updated_tmpl["next_due_date"])
    # One month ahead (could be same day next month)
    assert new_due > due_date
