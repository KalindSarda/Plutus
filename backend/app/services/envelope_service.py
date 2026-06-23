import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.category_envelope import CategoryEnvelope
from app.models.category import Category
from app.models.account import Account
from app.models.credit_card import CreditCard


def _resolve_names(envelope: CategoryEnvelope, db: Session) -> dict:
    category = db.query(Category).filter(Category.id == envelope.category_id).first()
    account_name = None
    if envelope.account_id:
        account = db.query(Account).filter(Account.id == envelope.account_id).first()
        account_name = account.name if account else None
    cc_name = None
    if envelope.credit_card_id:
        cc = db.query(CreditCard).filter(CreditCard.id == envelope.credit_card_id).first()
        cc_name = cc.name if cc else None
    return {
        "id": envelope.id,
        "category_id": envelope.category_id,
        "category_name": category.name if category else "",
        "account_id": envelope.account_id,
        "account_name": account_name,
        "credit_card_id": envelope.credit_card_id,
        "cc_name": cc_name,
    }


def list_envelopes(user_id: uuid.UUID, db: Session) -> list[dict]:
    envelopes = db.query(CategoryEnvelope).filter(CategoryEnvelope.user_id == user_id).all()
    return [_resolve_names(e, db) for e in envelopes]


def get_envelope(category_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> CategoryEnvelope | None:
    return db.query(CategoryEnvelope).filter(
        CategoryEnvelope.category_id == category_id,
        CategoryEnvelope.user_id == user_id,
    ).first()


def upsert_envelope(
    category_id: uuid.UUID,
    account_id: uuid.UUID | None,
    cc_id: uuid.UUID | None,
    user_id: uuid.UUID,
    db: Session,
) -> dict:
    if account_id:
        acc = db.query(Account).filter(Account.id == account_id, Account.user_id == user_id).first()
        if not acc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    if cc_id:
        card = db.query(CreditCard).filter(CreditCard.id == cc_id, CreditCard.user_id == user_id).first()
        if not card:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credit card not found")

    envelope = get_envelope(category_id, user_id, db)
    if envelope:
        envelope.account_id = account_id
        envelope.credit_card_id = cc_id
        envelope.updated_at = datetime.utcnow()
    else:
        envelope = CategoryEnvelope(
            user_id=user_id,
            category_id=category_id,
            account_id=account_id,
            credit_card_id=cc_id,
        )
        db.add(envelope)
    db.commit()
    db.refresh(envelope)
    return _resolve_names(envelope, db)


def delete_envelope(category_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> None:
    envelope = get_envelope(category_id, user_id, db)
    if not envelope:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Envelope not found")
    db.delete(envelope)
    db.commit()
