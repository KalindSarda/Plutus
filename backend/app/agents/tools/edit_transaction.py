import uuid
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.agents.session_store import session_store
from app.models.category import Category
from app.models.transaction import Transaction
from app.schemas.transaction import TransactionUpdate
from app.services import transaction_service


def make_edit_transaction(user_id: uuid.UUID, db: Session, session_key: str):
    def edit_transaction(
        description: str,
        amount: Optional[float] = None,
        category_name: Optional[str] = None,
        date: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> str:
        """
        Edit an existing transaction by searching for it by description or category.

        Args:
            description: keyword to search in transaction notes or category name
            amount: new amount (optional)
            category_name: new category name (optional, partial match ok)
            date: new date in YYYY-MM-DD format (optional)
            notes: new notes text (optional)
        """
        try:
            # 1. Search for matching transactions
            rows = (
                db.query(Transaction, Category.name.label("cat_name"))
                .outerjoin(Category, Transaction.category_id == Category.id)
                .filter(
                    Transaction.user_id == user_id,
                    (
                        Transaction.notes.ilike(f"%{description}%")
                        | Category.name.ilike(f"%{description}%")
                    ),
                )
                .order_by(Transaction.date.desc())
                .limit(5)
                .all()
            )

            if not rows:
                return f"No transaction matching '{description}' found."

            if len(rows) > 1:
                lines = [f"Multiple transactions match '{description}'. Please be more specific:"]
                for tx, cat_name in rows:
                    sign = "+" if tx.type == "income" else "-"
                    lines.append(
                        f"  {tx.date} | {sign}₹{float(tx.amount):,.2f} | {cat_name or 'Unknown'}"
                        + (f" | {tx.notes}" if tx.notes else "")
                    )
                return "\n".join(lines)

            tx, cat_name = rows[0]

            # 5. Snapshot previous values
            snapshot = {
                "amount": str(tx.amount),
                "category_id": str(tx.category_id),
                "date": str(tx.date),
                "notes": tx.notes,
                "account_id": str(tx.account_id) if tx.account_id else None,
                "credit_card_id": str(tx.credit_card_id) if tx.credit_card_id else None,
            }

            # 6-7. Build update
            update_kwargs = {}

            if amount is not None:
                update_kwargs["amount"] = Decimal(str(amount))

            if category_name is not None:
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
                update_kwargs["category_id"] = category.id

            if date is not None:
                from datetime import date as _date_type
                update_kwargs["date"] = _date_type.fromisoformat(date)

            if notes is not None:
                update_kwargs["notes"] = notes

            update_data = TransactionUpdate(**update_kwargs)

            # 8. Apply update
            updated_tx = transaction_service.update_transaction(tx.id, update_data, user_id, db)

            # 9. Store last action
            session_store.set_last_action(
                session_key,
                {
                    "type": "transaction_updated",
                    "resource_type": "transaction",
                    "resource_id": str(tx.id),
                    "undo_data": snapshot,
                },
            )

            # 10. Return result
            return (
                f"Updated transaction: {description} → now ₹{float(updated_tx.amount):,.2f} on {updated_tx.date}"
            )

        except Exception as e:
            return f"Failed to edit transaction: {str(e)}"

    return edit_transaction
