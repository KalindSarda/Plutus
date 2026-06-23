import uuid
from datetime import date as date_type
from typing import Optional

from sqlalchemy.orm import Session

from app.agents.session_store import session_store
from app.models.category import Category
from app.models.transaction import Transaction
from app.services import transaction_service


def make_delete_transaction(user_id: uuid.UUID, db: Session, session_key: str):
    def delete_transaction(
        description: str,
        date: Optional[str] = None,
    ) -> str:
        """
        Delete a transaction by searching for it by description or category name.

        Args:
            description: keyword to search in transaction notes or category name
            date: optional date in YYYY-MM-DD format to narrow the search
        """
        try:
            # 1. Search for matching transactions
            query = (
                db.query(Transaction, Category.name.label("cat_name"))
                .outerjoin(Category, Transaction.category_id == Category.id)
                .filter(
                    Transaction.user_id == user_id,
                    (
                        Transaction.notes.ilike(f"%{description}%")
                        | Category.name.ilike(f"%{description}%")
                    ),
                )
            )

            if date:
                try:
                    query = query.filter(Transaction.date == date_type.fromisoformat(date))
                except ValueError:
                    pass

            rows = query.order_by(Transaction.date.desc()).limit(5).all()

            if not rows:
                return "No matching transaction found."

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

            # 5. Snapshot ALL fields before delete
            snapshot = {
                "amount": str(tx.amount),
                "type": tx.type,
                "date": str(tx.date),
                "category_id": str(tx.category_id),
                "account_id": str(tx.account_id) if tx.account_id else None,
                "credit_card_id": str(tx.credit_card_id) if tx.credit_card_id else None,
                "notes": tx.notes,
                "tags": tx.tags or [],
                "is_recurring": tx.is_recurring,
            }

            # 6. Store resource_id BEFORE deleting
            resource_id = tx.id
            amount = float(tx.amount)
            tx_type = tx.type
            tx_date = tx.date

            # 7. Delete
            transaction_service.delete_transaction(resource_id, user_id, db)

            # 8. Store last action
            session_store.set_last_action(
                session_key,
                {
                    "type": "transaction_deleted",
                    "resource_type": "transaction",
                    "resource_id": str(resource_id),
                    "undo_data": snapshot,
                },
            )

            # 9. Return result
            return f"Deleted ₹{amount:,.2f} {tx_type} for {cat_name or 'Unknown'} on {tx_date}"

        except Exception as e:
            return f"Failed to delete transaction: {str(e)}"

    return delete_transaction
