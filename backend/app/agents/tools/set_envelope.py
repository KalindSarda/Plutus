import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.account import Account
from app.models.credit_card import CreditCard
from app.services import envelope_service
from app.agents import session_store as session_store_module


def make_set_envelope(user_id: uuid.UUID, db: Session, session_key: str):
    def set_envelope(
        category_name: str,
        account_name: Optional[str] = None,
        credit_card_name: Optional[str] = None,
    ) -> str:
        """Set or update the default account or credit card for a spending category (envelope budgeting). Use this when the user says 'set my default for Food to HDFC' or 'change my travel envelope to Axis Credit Card'."""
        try:
            # 1. Resolve category
            category = (
                db.query(Category)
                .filter(
                    Category.name.ilike(f"%{category_name}%"),
                    (Category.user_id == user_id) | (Category.user_id == None),  # noqa: E711
                )
                .first()
            )
            if not category:
                return f"Category '{category_name}' not found. Please check the name and try again."

            # 2. Resolve account if provided
            account_id: Optional[uuid.UUID] = None
            resolved_account_name: Optional[str] = None
            if account_name:
                account = (
                    db.query(Account)
                    .filter(
                        Account.name.ilike(f"%{account_name}%"),
                        Account.user_id == user_id,
                    )
                    .first()
                )
                if not account:
                    return f"Account '{account_name}' not found. Please check the name and try again."
                account_id = account.id
                resolved_account_name = account.name

            # 3. Resolve credit card if provided
            cc_id: Optional[uuid.UUID] = None
            resolved_cc_name: Optional[str] = None
            if credit_card_name:
                cc = (
                    db.query(CreditCard)
                    .filter(
                        CreditCard.name.ilike(f"%{credit_card_name}%"),
                        CreditCard.user_id == user_id,
                    )
                    .first()
                )
                if not cc:
                    return f"Credit card '{credit_card_name}' not found. Please check the name and try again."
                cc_id = cc.id
                resolved_cc_name = cc.name

            # 4. Require at least one destination
            if account_id is None and cc_id is None:
                return "Please specify either an account name or a credit card name to assign."

            # 5. Store previous envelope for undo
            existing = envelope_service.get_envelope(category.id, user_id, db)
            if existing:
                undo_data = {
                    "category_id": str(category.id),
                    "account_id": str(existing.account_id) if existing.account_id else None,
                    "credit_card_id": str(existing.credit_card_id) if existing.credit_card_id else None,
                }
            else:
                undo_data = {
                    "category_id": str(category.id),
                    "was_empty": True,
                }

            # 6. Upsert envelope
            envelope_service.upsert_envelope(category.id, account_id, cc_id, user_id, db)

            # 7. Record last action for undo
            session_store_module.session_store.set_last_action(
                session_key,
                {
                    "type": "envelope_set",
                    "resource_type": "envelope",
                    "resource_id": str(category.id),
                    "undo_data": undo_data,
                },
            )

            # 8. Return confirmation
            destination = resolved_account_name or resolved_cc_name
            return f"Envelope updated: {category.name} → {destination}"

        except Exception as exc:
            return f"Error setting envelope: {exc}"

    return set_envelope
