import uuid
import calendar
from datetime import date, timedelta
from typing import List

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.recurring_template import RecurringTemplate
from app.models.transaction import Transaction
from app.models.category import Category
from app.models.account import Account
from app.models.credit_card import CreditCard
from app.schemas.recurring import RecurringCreate, RecurringUpdate
from app.services.transaction_service import _apply_balance_effects


def _validate_ownership(data, user_id: uuid.UUID, db: Session) -> None:
    """Verify referenced category/account/credit_card belong to the user."""
    category_id = getattr(data, "category_id", None)
    account_id = getattr(data, "account_id", None)
    credit_card_id = getattr(data, "credit_card_id", None)

    if category_id:
        cat = db.query(Category).filter(
            Category.id == category_id,
            (Category.user_id == user_id) | (Category.user_id == None),
        ).first()
        if not cat:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    if account_id:
        acct = db.query(Account).filter(
            Account.id == account_id, Account.user_id == user_id
        ).first()
        if not acct:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    if credit_card_id:
        card = db.query(CreditCard).filter(
            CreditCard.id == credit_card_id, CreditCard.user_id == user_id
        ).first()
        if not card:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credit card not found")


def _add_months(d: date, months: int) -> date:
    """Add months to a date, clamping to the last day of the target month."""
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _advance_due_date(current: date, frequency: str) -> date:
    """Calculate the next due date based on frequency."""
    if frequency == "daily":
        return current + timedelta(days=1)
    elif frequency == "weekly":
        return current + timedelta(weeks=1)
    elif frequency == "monthly":
        return _add_months(current, 1)
    elif frequency == "yearly":
        return _add_months(current, 12)
    return current


def list_recurring(user_id: uuid.UUID, db: Session) -> List[RecurringTemplate]:
    return (
        db.query(RecurringTemplate)
        .filter(RecurringTemplate.user_id == user_id)
        .order_by(RecurringTemplate.next_due_date)
        .all()
    )


def create_recurring(data: RecurringCreate, user_id: uuid.UUID, db: Session) -> RecurringTemplate:
    _validate_ownership(data, user_id, db)
    tmpl = RecurringTemplate(user_id=user_id, **data.model_dump())
    db.add(tmpl)
    db.commit()
    db.refresh(tmpl)
    return tmpl


def get_recurring(tmpl_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> RecurringTemplate:
    tmpl = db.query(RecurringTemplate).filter(
        RecurringTemplate.id == tmpl_id, RecurringTemplate.user_id == user_id
    ).first()
    if not tmpl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurring template not found")
    return tmpl


def update_recurring(tmpl_id: uuid.UUID, data: RecurringUpdate, user_id: uuid.UUID, db: Session) -> RecurringTemplate:
    tmpl = get_recurring(tmpl_id, user_id, db)
    _validate_ownership(data, user_id, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(tmpl, field, value)
    db.commit()
    db.refresh(tmpl)
    return tmpl


def delete_recurring(tmpl_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> None:
    tmpl = get_recurring(tmpl_id, user_id, db)
    db.delete(tmpl)
    db.commit()


def apply_recurring(tmpl_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> Transaction:
    """
    Creates a Transaction from the recurring template and advances next_due_date.
    Returns the newly created transaction.
    """
    tmpl = get_recurring(tmpl_id, user_id, db)

    tx = Transaction(
        user_id=user_id,
        date=tmpl.next_due_date,
        type=tmpl.type,
        amount=tmpl.amount,
        category_id=tmpl.category_id,
        account_id=tmpl.account_id,
        credit_card_id=tmpl.credit_card_id,
        notes=f"Auto-applied from recurring: {tmpl.name}",
        is_recurring=True,
        recurring_template_id=tmpl.id,
    )
    db.add(tx)
    db.flush()

    _apply_balance_effects(tx.type, tx.amount, tx.account_id, tx.credit_card_id, db, sign=1)

    # Advance next_due_date
    tmpl.next_due_date = _advance_due_date(tmpl.next_due_date, tmpl.frequency)

    db.commit()
    db.refresh(tx)
    return tx
