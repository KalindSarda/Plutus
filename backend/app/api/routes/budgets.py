import uuid
from datetime import date
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.schemas.budget import BudgetCreate, BudgetUpdate, BudgetResponse, BudgetWithSpending
from app.services import budget_service

router = APIRouter()


@router.get("", response_model=list[BudgetWithSpending])
def list_budgets(
    year: int = Query(default=None),
    month: int = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    y = year if year else today.year
    m = month if month else today.month
    items = budget_service.get_budgets_with_spending(current_user.id, db, y, m)
    result = []
    for item in items:
        b = item["budget"]
        spent = item["spent"]
        result.append(
            BudgetWithSpending(
                id=b.id,
                category_id=b.category_id,
                amount=b.amount,
                period=b.period,
                start_date=b.start_date,
                spent=spent,
            )
        )
    return result


@router.post("", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
def create_budget(
    data: BudgetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return budget_service.create_budget(data, current_user.id, db)


@router.put("/{budget_id}", response_model=BudgetResponse)
def update_budget(
    budget_id: uuid.UUID,
    data: BudgetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return budget_service.update_budget(budget_id, data, current_user.id, db)


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(
    budget_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    budget_service.delete_budget(budget_id, current_user.id, db)
