import uuid
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.agents.session_store import session_store
from app.models.account import Account
from app.schemas.account import AccountUpdate
from app.services import account_service


def make_edit_account(user_id: uuid.UUID, db: Session, session_key: str):
    def edit_account(
        account_name: str,
        new_name: Optional[str] = None,
        balance: Optional[float] = None,
        bank_name: Optional[str] = None,
    ) -> str:
        """
        Update an existing bank account's details.

        Args:
            account_name: current name of the account to find (partial match ok)
            new_name: rename the account to this (optional)
            balance: new balance amount in rupees (optional)
            bank_name: new bank name (optional)
        """
        try:
            # 1. Find account
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

            # 2. Snapshot
            snapshot = {
                "name": account.name,
                "bank_name": account.bank_name,
                "balance": str(account.balance),
                "type": account.type,
            }

            # 3. Build update with only provided non-None fields
            update_kwargs = {}
            changes = []

            if new_name is not None:
                update_kwargs["name"] = new_name
                changes.append(f"name → '{new_name}'")

            if balance is not None:
                update_kwargs["balance"] = Decimal(str(balance))
                changes.append(f"balance → ₹{balance:,.2f}")

            if bank_name is not None:
                update_kwargs["bank_name"] = bank_name
                changes.append(f"bank → '{bank_name}'")

            if not update_kwargs:
                return f"No changes provided for account '{account.name}'."

            update_data = AccountUpdate(**update_kwargs)

            # 4. Apply update
            updated = account_service.update_account(account.id, update_data, user_id, db)

            # 5. Store last action
            session_store.set_last_action(
                session_key,
                {
                    "type": "account_updated",
                    "resource_type": "account",
                    "resource_id": str(account.id),
                    "undo_data": snapshot,
                },
            )

            display_name = updated.name if updated else (new_name or account.name)
            changes_str = ", ".join(changes)
            return f"Updated account '{display_name}': {changes_str}"

        except Exception as e:
            return f"Failed to edit account: {str(e)}"

    return edit_account
