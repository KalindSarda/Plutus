import uuid
from datetime import date as Date, datetime
from decimal import Decimal
from typing import List, Optional, Literal
from pydantic import BaseModel


class TransactionCreate(BaseModel):
    date: Date
    type: Literal["income", "expense"]
    amount: Decimal
    category_id: uuid.UUID
    account_id: Optional[uuid.UUID] = None
    credit_card_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = []
    is_recurring: bool = False


class TransactionUpdate(BaseModel):
    date: Optional[Date] = None
    amount: Optional[Decimal] = None
    category_id: Optional[uuid.UUID] = None
    account_id: Optional[uuid.UUID] = None
    credit_card_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None


class TransactionResponse(BaseModel):
    id: uuid.UUID
    date: Date
    type: str
    amount: Decimal
    category_id: uuid.UUID
    account_id: Optional[uuid.UUID]
    credit_card_id: Optional[uuid.UUID]
    notes: Optional[str]
    tags: Optional[List[str]]
    is_recurring: bool
    created_at: datetime

    model_config = {"from_attributes": True}
