import uuid
from calendar import monthrange
from datetime import date
from decimal import Decimal
from typing import List, TypedDict

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.budget import Budget
from app.models.category import Category
from app.models.credit_card import CreditCard
from app.models.transaction import Transaction


class CategoryAmount(TypedDict):
    category_name: str
    amount: Decimal
    type: str


class MonthlySummary(TypedDict):
    year: int
    month: int
    total_income: Decimal
    total_expense: Decimal
    net_savings: Decimal
    total_balance: Decimal
    top_categories: List[CategoryAmount]


def _month_range(year: int, month: int) -> tuple[date, date]:
    start = date(year, month, 1)
    end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    return start, end


def get_monthly_summary(user_id: uuid.UUID, db: Session, year: int, month: int) -> MonthlySummary:
    period_start, period_end = _month_range(year, month)

    rows = (
        db.query(Transaction.type, func.sum(Transaction.amount))
        .filter(
            Transaction.user_id == user_id,
            Transaction.date >= period_start,
            Transaction.date < period_end,
        )
        .group_by(Transaction.type)
        .all()
    )

    totals: dict[str, Decimal] = {"income": Decimal("0.00"), "expense": Decimal("0.00")}
    for tx_type, amount in rows:
        totals[tx_type] = amount or Decimal("0.00")

    total_income = totals["income"]
    total_expense = totals["expense"]
    net_savings = total_income - total_expense

    balance_row = (
        db.query(func.sum(Account.balance))
        .filter(Account.user_id == user_id, Account.is_active == True)
        .scalar()
    )
    total_balance = balance_row or Decimal("0.00")

    cat_rows = (
        db.query(Category.name, Transaction.type, func.sum(Transaction.amount).label("total"))
        .join(Category, Transaction.category_id == Category.id)
        .filter(
            Transaction.user_id == user_id,
            Transaction.date >= period_start,
            Transaction.date < period_end,
        )
        .group_by(Category.name, Transaction.type)
        .order_by(func.sum(Transaction.amount).desc())
        .limit(5)
        .all()
    )

    top_categories: List[CategoryAmount] = [
        {"category_name": name, "amount": amt or Decimal("0.00"), "type": tx_type}
        for name, tx_type, amt in cat_rows
    ]

    return {
        "year": year,
        "month": month,
        "total_income": total_income,
        "total_expense": total_expense,
        "net_savings": net_savings,
        "total_balance": total_balance,
        "top_categories": top_categories,
    }


def get_category_breakdown(user_id: uuid.UUID, db: Session, year: int, month: int) -> list[dict]:
    """All categories with totals for the given month, sorted by amount desc."""
    period_start, period_end = _month_range(year, month)

    rows = (
        db.query(
            Category.name,
            Category.color,
            Category.icon,
            Transaction.type,
            func.sum(Transaction.amount).label("total"),
        )
        .join(Category, Transaction.category_id == Category.id)
        .filter(
            Transaction.user_id == user_id,
            Transaction.date >= period_start,
            Transaction.date < period_end,
        )
        .group_by(Category.name, Category.color, Category.icon, Transaction.type)
        .order_by(func.sum(Transaction.amount).desc())
        .all()
    )

    total_expense = sum(r.total for r in rows if r.type == "expense") or Decimal("1")

    result = []
    for r in rows:
        pct = float(r.total / total_expense * 100) if r.type == "expense" else None
        result.append({
            "category_name": r.name,
            "color": r.color or "#5a7a6a",
            "icon": r.icon or "📦",
            "type": r.type,
            "amount": r.total or Decimal("0.00"),
            "percentage": round(pct, 1) if pct is not None else None,
        })

    return result


def get_monthly_trends(user_id: uuid.UUID, db: Session, months: int = 6) -> list[dict]:
    """Income and expense totals for each of the last N months."""
    today = date.today()
    result = []

    for i in range(months - 1, -1, -1):
        # Go back i months from current
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1

        period_start, period_end = _month_range(y, m)

        rows = (
            db.query(Transaction.type, func.sum(Transaction.amount))
            .filter(
                Transaction.user_id == user_id,
                Transaction.date >= period_start,
                Transaction.date < period_end,
            )
            .group_by(Transaction.type)
            .all()
        )

        totals: dict[str, Decimal] = {"income": Decimal("0.00"), "expense": Decimal("0.00")}
        for tx_type, amount in rows:
            totals[tx_type] = amount or Decimal("0.00")

        result.append({
            "year": y,
            "month": m,
            "month_label": date(y, m, 1).strftime("%b %Y"),
            "income": totals["income"],
            "expense": totals["expense"],
            "savings": totals["income"] - totals["expense"],
        })

    return result


def get_net_worth(user_id: uuid.UUID, db: Session) -> dict:
    """Total assets (account balances) minus total CC outstanding."""
    total_assets = (
        db.query(func.sum(Account.balance))
        .filter(Account.user_id == user_id, Account.is_active == True)
        .scalar()
    ) or Decimal("0.00")

    total_cc_outstanding = (
        db.query(func.sum(CreditCard.current_outstanding))
        .filter(CreditCard.user_id == user_id, CreditCard.is_active == True)
        .scalar()
    ) or Decimal("0.00")

    return {
        "total_assets": total_assets,
        "total_liabilities": total_cc_outstanding,
        "net_worth": total_assets - total_cc_outstanding,
    }


def get_projection(user_id: uuid.UUID, db: Session) -> dict:
    """Average monthly savings over last 3 months, projected as next month estimate."""
    trends = get_monthly_trends(user_id, db, months=3)

    if not trends:
        return {"avg_income": Decimal("0"), "avg_expense": Decimal("0"), "projected_savings": Decimal("0")}

    avg_income = sum(t["income"] for t in trends) / len(trends)
    avg_expense = sum(t["expense"] for t in trends) / len(trends)
    projected_savings = avg_income - avg_expense

    return {
        "avg_income": avg_income,
        "avg_expense": avg_expense,
        "projected_savings": projected_savings,
        "based_on_months": len(trends),
    }


def get_all_transactions_for_export(user_id: uuid.UUID, db: Session) -> list[dict]:
    """Fetch all transactions with category and account names for CSV export."""
    rows = (
        db.query(
            Transaction,
            Category.name.label("category_name"),
            Account.name.label("account_name"),
            CreditCard.name.label("cc_name"),
        )
        .outerjoin(Category, Transaction.category_id == Category.id)
        .outerjoin(Account, Transaction.account_id == Account.id)
        .outerjoin(CreditCard, Transaction.credit_card_id == CreditCard.id)
        .filter(Transaction.user_id == user_id)
        .order_by(Transaction.date.desc())
        .all()
    )

    result = []
    for tx, cat_name, acc_name, cc_name in rows:
        result.append({
            "id": str(tx.id),
            "date": tx.date.isoformat(),
            "type": tx.type,
            "amount": str(tx.amount),
            "category": cat_name or "",
            "account": acc_name or "",
            "credit_card": cc_name or "",
            "notes": tx.notes or "",
            "tags": ",".join(tx.tags) if tx.tags else "",
            "is_recurring": "Yes" if tx.is_recurring else "No",
        })

    return result
