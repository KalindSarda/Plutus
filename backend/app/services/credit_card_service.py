import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.credit_card import CreditCard
from app.schemas.credit_card import CreditCardCreate, CreditCardUpdate


def _sync_available_limit(card: CreditCard) -> None:
    card.available_limit = card.credit_limit - card.current_outstanding


def list_credit_cards(user_id: uuid.UUID, db: Session) -> list[CreditCard]:
    return db.query(CreditCard).filter(CreditCard.user_id == user_id).all()


def create_credit_card(data: CreditCardCreate, user_id: uuid.UUID, db: Session) -> CreditCard:
    card_data = data.model_dump()
    card = CreditCard(user_id=user_id, **card_data)
    _sync_available_limit(card)
    db.add(card)
    db.commit()
    db.refresh(card)
    return card


def get_credit_card(card_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> CreditCard:
    card = db.query(CreditCard).filter(
        CreditCard.id == card_id, CreditCard.user_id == user_id
    ).first()
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credit card not found")
    return card


def update_credit_card(card_id: uuid.UUID, data: CreditCardUpdate, user_id: uuid.UUID, db: Session) -> CreditCard:
    card = get_credit_card(card_id, user_id, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(card, field, value)
    _sync_available_limit(card)
    db.commit()
    db.refresh(card)
    return card


def delete_credit_card(card_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> None:
    card = get_credit_card(card_id, user_id, db)
    db.delete(card)
    db.commit()
