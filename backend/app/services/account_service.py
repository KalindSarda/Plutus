import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.account import Account
from app.schemas.account import AccountCreate, AccountUpdate


def list_accounts(user_id: uuid.UUID, db: Session) -> list[Account]:
    return db.query(Account).filter(Account.user_id == user_id).all()


def create_account(data: AccountCreate, user_id: uuid.UUID, db: Session) -> Account:
    account = Account(user_id=user_id, **data.model_dump())
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def get_account(account_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> Account:
    account = db.query(Account).filter(
        Account.id == account_id, Account.user_id == user_id
    ).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account


def update_account(account_id: uuid.UUID, data: AccountUpdate, user_id: uuid.UUID, db: Session) -> Account:
    account = get_account(account_id, user_id, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(account, field, value)
    db.commit()
    db.refresh(account)
    return account


def delete_account(account_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> None:
    account = get_account(account_id, user_id, db)
    db.delete(account)
    db.commit()


def get_account_summary(account_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> dict:
    from app.models.transaction import Transaction
    account = get_account(account_id, user_id, db)
    txs = db.query(Transaction).filter(
        Transaction.account_id == account_id,
        Transaction.user_id == user_id,
    ).all()
    total_income = sum(t.amount for t in txs if t.type == "income")
    total_expense = sum(t.amount for t in txs if t.type == "expense")
    return {
        "account": account,
        "total_income": total_income,
        "total_expense": total_expense,
        "transaction_count": len(txs),
    }
