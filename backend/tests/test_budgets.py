"""Budget endpoint and service tests."""

import uuid
from datetime import date
from decimal import Decimal

from app.models.category import Category
from app.models.transaction import Transaction
from app.services import budget_service


def _seed_category(db) -> Category:
    cat = Category(
        id=uuid.uuid4(),
        user_id=None,
        name="Food",
        type="expense",
        is_default=True,
    )
    db.add(cat)
    db.commit()
    return cat


def test_create_budget_and_list_returns_spent_zero(client, auth_headers, db):
    """Creating a budget then listing it should show spent=0 when no transactions exist."""
    cat = _seed_category(db)

    create_resp = client.post(
        "/api/budgets",
        headers=auth_headers,
        json={
            "category_id": str(cat.id),
            "amount": "500.00",
            "period": "monthly",
            "start_date": str(date.today()),
        },
    )
    assert create_resp.status_code == 201, create_resp.json()

    list_resp = client.get("/api/budgets", headers=auth_headers)
    assert list_resp.status_code == 200
    budgets = list_resp.json()
    assert len(budgets) == 1
    assert budgets[0]["amount"] == "500.00"
    assert Decimal(budgets[0]["spent"]) == Decimal("0.00")


def test_budget_spent_updates_with_transactions(client, auth_headers, db):
    """get_budgets_with_spending should reflect actual expense transactions."""
    # Get the logged-in user id via /me
    me_resp = client.get("/api/auth/me", headers=auth_headers)
    user_id = uuid.UUID(me_resp.json()["id"])

    cat = _seed_category(db)

    # Create a budget via the service directly
    from app.schemas.budget import BudgetCreate
    budget = budget_service.create_budget(
        BudgetCreate(
            category_id=cat.id,
            amount=Decimal("300.00"),
            period="monthly",
            start_date=date(2025, 1, 1),
        ),
        user_id,
        db,
    )

    # Add an expense transaction for this category this month
    today = date.today()
    tx = Transaction(
        id=uuid.uuid4(),
        user_id=user_id,
        date=today,
        type="expense",
        amount=Decimal("75.50"),
        category_id=cat.id,
    )
    db.add(tx)
    db.commit()

    results = budget_service.get_budgets_with_spending(user_id, db, today.year, today.month)
    assert len(results) == 1
    assert results[0]["spent"] == Decimal("75.50")
