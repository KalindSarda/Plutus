import uuid
from datetime import date
from decimal import Decimal
from typing import List

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.budget import Budget
from app.models.category import Category
from app.models.transaction import Transaction
from app.schemas.budget import BudgetCreate, BudgetUpdate


def list_budgets(user_id: uuid.UUID, db: Session) -> List[Budget]:
    return (
        db.query(Budget)
        .filter(Budget.user_id == user_id)
        .order_by(Budget.start_date.desc())
        .all()
    )


def create_budget(data: BudgetCreate, user_id: uuid.UUID, db: Session) -> Budget:
    # Verify category belongs to user or is global
    cat = db.query(Category).filter(
        Category.id == data.category_id,
        (Category.user_id == user_id) | (Category.user_id == None),
    ).first()
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    budget = Budget(user_id=user_id, **data.model_dump())
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget


def get_budget(budget_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> Budget:
    budget = db.query(Budget).filter(
        Budget.id == budget_id, Budget.user_id == user_id
    ).first()
    if not budget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")
    return budget


def update_budget(budget_id: uuid.UUID, data: BudgetUpdate, user_id: uuid.UUID, db: Session) -> Budget:
    budget = get_budget(budget_id, user_id, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(budget, field, value)
    db.commit()
    db.refresh(budget)
    return budget


def delete_budget(budget_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> None:
    budget = get_budget(budget_id, user_id, db)
    db.delete(budget)
    db.commit()


def get_budgets_with_spending(
    user_id: uuid.UUID,
    db: Session,
    year: int,
    month: int,
) -> List[dict]:
    """
    Returns each budget enriched with `spent` — the total expense transactions
    for that category in the given month/year.
    """
    budgets = list_budgets(user_id, db)

    # Build a map of category_id -> sum of expenses for the period
    period_start = date(year, month, 1)
    # Last day of month
    if month == 12:
        period_end = date(year + 1, 1, 1)
    else:
        period_end = date(year, month + 1, 1)

    rows = (
        db.query(Transaction.category_id, func.sum(Transaction.amount))
        .filter(
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            Transaction.date >= period_start,
            Transaction.date < period_end,
        )
        .group_by(Transaction.category_id)
        .all()
    )
    spending_map: dict[uuid.UUID, Decimal] = {row[0]: row[1] for row in rows}

    result = []
    for budget in budgets:
        spent = spending_map.get(budget.category_id, Decimal("0.00"))
        result.append({"budget": budget, "spent": spent})
    return result
