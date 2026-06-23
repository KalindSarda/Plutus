import uuid
from datetime import date as date_type
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.agents.session_store import session_store
from app.models.account import Account
from app.models.category import Category
from app.models.credit_card import CreditCard
from app.schemas.transaction import TransactionCreate
from app.services import transaction_service, envelope_service


def make_add_transaction(user_id: uuid.UUID, db: Session, session_key: str):
    def add_transaction(
        type: str,
        amount: float,
        category_name: str,
        date: Optional[str] = None,
        account_name: Optional[str] = None,
        credit_card_name: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> str:
        """
        Add a new income or expense transaction.

        Args:
            type: 'income' or 'expense'
            amount: positive number
            category_name: name of the category (partial match ok)
            date: date in YYYY-MM-DD format (defaults to today)
            account_name: name of the bank account to use (optional)
            credit_card_name: name of the credit card to use (optional)
            notes: optional note about the transaction
        """
        try:
            # 1. Resolve category
            category = (
                db.query(Category)
                .filter(
                    Category.name.ilike(f"%{category_name}%"),
                    (Category.user_id == user_id) | (Category.user_id == None),
                )
                .first()
            )
            if not category:
                return f"Category '{category_name}' not found. Please check the category name."

            # 2. Resolve account
            account_id = None
            account_actual_name = None
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
                    return f"Account '{account_name}' not found. Please check the account name."
                account_id = account.id
                account_actual_name = account.name

            # 3. Resolve credit card
            credit_card_id = None
            cc_actual_name = None
            if credit_card_name:
                card = (
                    db.query(CreditCard)
                    .filter(
                        CreditCard.name.ilike(f"%{credit_card_name}%"),
                        CreditCard.user_id == user_id,
                    )
                    .first()
                )
                if not card:
                    return f"Credit card '{credit_card_name}' not found. Please check the card name."
                credit_card_id = card.id
                cc_actual_name = card.name

            # 4. Parse date
            tx_date = date_type.fromisoformat(date) if date else date_type.today()

            # 5. Build and create
            data = TransactionCreate(
                date=tx_date,
                type=type.lower(),
                amount=Decimal(str(amount)),
                category_id=category.id,
                account_id=account_id,
                credit_card_id=credit_card_id,
                notes=notes,
            )
            tx = transaction_service.create_transaction(data, user_id, db)

            result = f"Added {tx.type} of ₹{float(tx.amount):,.2f} under {category.name} on {tx.date}"

            # 6. Envelope deviation check
            envelope = envelope_service.get_envelope(category.id, user_id, db)
            if envelope:
                deviation = False
                expected_name = None
                actual_name = None

                if envelope.account_id and tx.account_id != envelope.account_id:
                    exp_acct = db.query(Account).filter(Account.id == envelope.account_id).first()
                    expected_name = exp_acct.name if exp_acct else str(envelope.account_id)
                    actual_name = account_actual_name or "(none)"
                    deviation = True
                elif envelope.credit_card_id and tx.credit_card_id != envelope.credit_card_id:
                    exp_cc = db.query(CreditCard).filter(CreditCard.id == envelope.credit_card_id).first()
                    expected_name = exp_cc.name if exp_cc else str(envelope.credit_card_id)
                    actual_name = cc_actual_name or "(none)"
                    deviation = True

                if deviation:
                    result += f"\n⚠ ENVELOPE_DEVIATION: envelope expects {expected_name}, you used {actual_name}"

            # 7. Store last action
            session_store.set_last_action(
                session_key,
                {
                    "type": "transaction_created",
                    "resource_type": "transaction",
                    "resource_id": str(tx.id),
                    "undo_data": {},
                },
            )

            return result

        except Exception as e:
            return f"Failed to add transaction: {str(e)}"

    return add_transaction
