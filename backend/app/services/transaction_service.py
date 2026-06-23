import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.transaction import Transaction
from app.models.account import Account
from app.models.credit_card import CreditCard
from app.models.category import Category
from app.schemas.transaction import TransactionCreate, TransactionUpdate


def _validate_ownership(data: TransactionCreate | TransactionUpdate, user_id: uuid.UUID, db: Session) -> None:
    """Verify that referenced account and credit_card belong to the user."""
    account_id = getattr(data, "account_id", None)
    credit_card_id = getattr(data, "credit_card_id", None)
    category_id = getattr(data, "category_id", None)

    if account_id:
        account = db.query(Account).filter(
            Account.id == account_id, Account.user_id == user_id
        ).first()
        if not account:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    if credit_card_id:
        card = db.query(CreditCard).filter(
            CreditCard.id == credit_card_id, CreditCard.user_id == user_id
        ).first()
        if not card:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credit card not found")

    if category_id:
        cat = db.query(Category).filter(
            Category.id == category_id,
            (Category.user_id == user_id) | (Category.user_id == None),
        ).first()
        if not cat:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")


def _adjust_cc_outstanding(cc_id: uuid.UUID | None, db: Session, delta: Decimal) -> None:
    if cc_id:
        card = db.query(CreditCard).filter(CreditCard.id == cc_id).first()
        if card:
            card.current_outstanding += delta
            card.available_limit = card.credit_limit - card.current_outstanding


def _adjust_account_balance(account_id: uuid.UUID | None, db: Session, delta: Decimal) -> None:
    """Positive delta increases balance (income); negative delta decreases it (expense)."""
    if account_id:
        account = db.query(Account).filter(Account.id == account_id).first()
        if account:
            account.balance += delta


def _apply_balance_effects(
    tx_type: str, amount: Decimal,
    account_id: uuid.UUID | None, cc_id: uuid.UUID | None,
    db: Session, sign: int = 1,
) -> None:
    """Apply (sign=1) or reverse (sign=-1) the balance side-effects of a transaction."""
    d = Decimal(sign)
    if tx_type == "expense":
        _adjust_cc_outstanding(cc_id, db, d * amount)
        _adjust_account_balance(account_id, db, -d * amount)
    elif tx_type == "income":
        _adjust_account_balance(account_id, db, d * amount)


def list_transactions(user_id: uuid.UUID, db: Session, skip: int = 0, limit: int = 50) -> list[Transaction]:
    return (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id)
        .order_by(Transaction.date.desc(), Transaction.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def create_transaction(data: TransactionCreate, user_id: uuid.UUID, db: Session) -> Transaction:
    _validate_ownership(data, user_id, db)
    tx = Transaction(user_id=user_id, **data.model_dump())
    db.add(tx)
    db.flush()

    _apply_balance_effects(tx.type, tx.amount, tx.account_id, tx.credit_card_id, db, sign=1)

    db.commit()
    db.refresh(tx)
    return tx


def get_transaction(tx_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> Transaction:
    tx = db.query(Transaction).filter(
        Transaction.id == tx_id, Transaction.user_id == user_id
    ).first()
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    return tx


def update_transaction(tx_id: uuid.UUID, data: TransactionUpdate, user_id: uuid.UUID, db: Session) -> Transaction:
    tx = get_transaction(tx_id, user_id, db)
    _validate_ownership(data, user_id, db)

    # Capture state before changes so we can reverse it accurately
    old_type = tx.type
    old_amount = tx.amount
    old_account_id = tx.account_id
    old_cc_id = tx.credit_card_id

    _apply_balance_effects(old_type, old_amount, old_account_id, old_cc_id, db, sign=-1)

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(tx, field, value)

    _apply_balance_effects(tx.type, tx.amount, tx.account_id, tx.credit_card_id, db, sign=1)

    db.commit()
    db.refresh(tx)
    return tx


def delete_transaction(tx_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> None:
    tx = get_transaction(tx_id, user_id, db)

    _apply_balance_effects(tx.type, tx.amount, tx.account_id, tx.credit_card_id, db, sign=-1)

    db.delete(tx)
    db.commit()
