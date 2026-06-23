import uuid
import calendar
from datetime import date
from decimal import Decimal
from typing import List

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.credit_card import CreditCard
from app.models.credit_card_statement import CreditCardStatement
from app.models.transaction import Transaction


def _get_card(card_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> CreditCard:
    card = db.query(CreditCard).filter(
        CreditCard.id == card_id, CreditCard.user_id == user_id
    ).first()
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credit card not found")
    return card


def get_current_cycle(card_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> dict:
    """
    Returns current billing cycle spending summary.
    The cycle starts on billing_cycle_day of the current or previous month.
    """
    card = _get_card(card_id, user_id, db)

    today = date.today()
    cycle_day = card.billing_cycle_day

    # Determine the start of the current billing cycle
    if today.day >= cycle_day:
        cycle_start = date(today.year, today.month, cycle_day)
    else:
        # Cycle started last month
        prev_month = today.month - 1 if today.month > 1 else 12
        prev_year = today.year if today.month > 1 else today.year - 1
        last_day = calendar.monthrange(prev_year, prev_month)[1]
        actual_day = min(cycle_day, last_day)
        cycle_start = date(prev_year, prev_month, actual_day)

    rows = (
        db.query(func.sum(Transaction.amount), func.count(Transaction.id))
        .filter(
            Transaction.credit_card_id == card_id,
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            Transaction.date >= cycle_start,
            Transaction.date <= today,
        )
        .first()
    )
    total_spent = rows[0] or Decimal("0.00")
    tx_count = rows[1] or 0

    return {
        "credit_card_id": card_id,
        "billing_cycle_day": cycle_day,
        "cycle_start": cycle_start,
        "total_spent": total_spent,
        "transaction_count": tx_count,
    }


def list_statements(card_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> List[CreditCardStatement]:
    # Verify card ownership
    _get_card(card_id, user_id, db)
    return (
        db.query(CreditCardStatement)
        .filter(
            CreditCardStatement.credit_card_id == card_id,
            CreditCardStatement.user_id == user_id,
        )
        .order_by(CreditCardStatement.billing_period_end.desc())
        .all()
    )


def create_statement(
    card_id: uuid.UUID,
    user_id: uuid.UUID,
    db: Session,
    billing_period_start: date,
    billing_period_end: date,
    due_date: date,
) -> CreditCardStatement:
    """
    Compute the total from transactions in the billing period and create a statement.
    """
    _get_card(card_id, user_id, db)

    total_row = (
        db.query(func.sum(Transaction.amount))
        .filter(
            Transaction.credit_card_id == card_id,
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            Transaction.date >= billing_period_start,
            Transaction.date <= billing_period_end,
        )
        .scalar()
    )
    total = total_row or Decimal("0.00")

    stmt = CreditCardStatement(
        user_id=user_id,
        credit_card_id=card_id,
        billing_period_start=billing_period_start,
        billing_period_end=billing_period_end,
        total_amount=total,
        due_date=due_date,
    )
    db.add(stmt)
    db.commit()
    db.refresh(stmt)
    return stmt


def pay_statement(
    card_id: uuid.UUID,
    stmt_id: uuid.UUID,
    user_id: uuid.UUID,
    db: Session,
    paid_amount: Decimal,
) -> CreditCardStatement:
    """
    Marks a statement as paid and reduces the card's outstanding balance.
    """
    _get_card(card_id, user_id, db)

    stmt = db.query(CreditCardStatement).filter(
        CreditCardStatement.id == stmt_id,
        CreditCardStatement.credit_card_id == card_id,
        CreditCardStatement.user_id == user_id,
    ).first()
    if not stmt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Statement not found")
    if stmt.is_paid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Statement already paid")

    stmt.is_paid = True
    stmt.paid_date = date.today()
    stmt.paid_amount = paid_amount

    # Reduce outstanding on the card
    card = db.query(CreditCard).filter(CreditCard.id == card_id).first()
    if card:
        card.current_outstanding = max(Decimal("0.00"), card.current_outstanding - paid_amount)
        card.available_limit = card.credit_limit - card.current_outstanding

    db.commit()
    db.refresh(stmt)
    return stmt
