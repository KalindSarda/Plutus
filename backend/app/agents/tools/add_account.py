import uuid
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.agents.session_store import session_store
from app.schemas.account import AccountCreate
from app.services import account_service


def make_add_account(user_id: uuid.UUID, db: Session, session_key: str):
    def add_account(
        name: str,
        bank_name: str,
        account_type: Optional[str] = "savings",
        balance: Optional[float] = 0.0,
    ) -> str:
        """
        Create a new bank account.

        Args:
            name: account name or label (e.g. 'HDFC Salary')
            bank_name: name of the bank (e.g. 'HDFC Bank')
            account_type: 'savings' or 'current' (defaults to 'savings')
            balance: opening balance in rupees (defaults to 0)
        """
        try:
            # 1. Validate account type
            if account_type not in ("savings", "current"):
                account_type = "savings"

            opening_balance = balance or 0.0

            # 2. Build and create account
            data = AccountCreate(
                name=name,
                bank_name=bank_name,
                type=account_type,
                balance=Decimal(str(opening_balance)),
            )
            account = account_service.create_account(data, user_id, db)

            # 3. Store last action
            session_store.set_last_action(
                session_key,
                {
                    "type": "account_created",
                    "resource_type": "account",
                    "resource_id": str(account.id),
                    "undo_data": {},
                },
            )

            return (
                f"Created {account_type} account '{name}' at {bank_name} "
                f"with balance ₹{opening_balance:,.2f}"
            )

        except Exception as e:
            return f"Failed to add account: {str(e)}"

    return add_account
