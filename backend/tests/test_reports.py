"""Report service tests — monthly summary."""

import uuid
from datetime import date
from decimal import Decimal

from app.models.category import Category
from app.models.transaction import Transaction
from app.models.account import Account
from app.services import report_service


def test_monthly_summary_returns_correct_totals(client, auth_headers, db):
    """
    After adding income and expense transactions the summary should reflect them.
    """
    me_resp = client.get("/api/auth/me", headers=auth_headers)
    assert me_resp.status_code == 200, me_resp.json()
    user_id = uuid.UUID(me_resp.json()["id"])

    # Seed categories
    income_cat = Category(id=uuid.uuid4(), user_id=None, name="Salary", type="income", is_default=True)
    expense_cat = Category(id=uuid.uuid4(), user_id=None, name="Rent", type="expense", is_default=True)
    db.add_all([income_cat, expense_cat])

    # Seed account
    account = Account(
        id=uuid.uuid4(),
        user_id=user_id,
        name="Main Account",
        type="savings",
        bank_name="Test Bank",
        balance=Decimal("5000.00"),
    )
    db.add(account)

    today = date.today()

    # Add transactions in the current month
    tx_income = Transaction(
        id=uuid.uuid4(),
        user_id=user_id,
        date=today,
        type="income",
        amount=Decimal("3000.00"),
        category_id=income_cat.id,
    )
    tx_expense = Transaction(
        id=uuid.uuid4(),
        user_id=user_id,
        date=today,
        type="expense",
        amount=Decimal("1200.00"),
        category_id=expense_cat.id,
    )
    db.add_all([tx_income, tx_expense])
    db.commit()

    summary = report_service.get_monthly_summary(user_id, db, today.year, today.month)

    assert summary["total_income"] == Decimal("3000.00")
    assert summary["total_expense"] == Decimal("1200.00")
    assert summary["net_savings"] == Decimal("1800.00")
    assert summary["total_balance"] == Decimal("5000.00")
    assert len(summary["top_categories"]) == 2


def test_monthly_summary_via_api(client, auth_headers):
    """GET /api/reports/summary should return a valid JSON structure."""
    today = date.today()
    resp = client.get(
        f"/api/reports/summary?year={today.year}&month={today.month}",
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.json()
    data = resp.json()
    assert "total_income" in data
    assert "total_expense" in data
    assert "net_savings" in data
    assert "total_balance" in data
    assert "top_categories" in data
