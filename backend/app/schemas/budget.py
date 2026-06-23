import uuid
from datetime import date
from decimal import Decimal
from typing import Literal, Optional
from pydantic import BaseModel


class BudgetCreate(BaseModel):
    category_id: uuid.UUID
    amount: Decimal
    period: Literal["monthly", "yearly"]
    start_date: date


class BudgetUpdate(BaseModel):
    amount: Optional[Decimal] = None
    period: Optional[Literal["monthly", "yearly"]] = None


class BudgetResponse(BaseModel):
    id: uuid.UUID
    category_id: uuid.UUID
    amount: Decimal
    period: str
    start_date: date

    model_config = {"from_attributes": True}


class BudgetWithSpending(BudgetResponse):
    spent: Decimal = Decimal("0.00")
