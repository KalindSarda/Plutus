import uuid
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.agents.session_store import session_store
from app.models.budget import Budget
from app.models.category import Category
from app.schemas.budget import BudgetUpdate
from app.services import budget_service


def make_edit_budget(user_id: uuid.UUID, db: Session, session_key: str):
    def edit_budget(
        category_name: str,
        amount: Optional[float] = None,
        period: Optional[str] = None,
    ) -> str:
        """
        Update an existing budget for a category.

        Args:
            category_name: name of the category whose budget to update (partial match ok)
            amount: new budget amount in rupees (optional)
            period: new period — 'monthly' or 'yearly' (optional)
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

            # 2. Find existing budget
            budget = (
                db.query(Budget)
                .filter(Budget.user_id == user_id, Budget.category_id == category.id)
                .first()
            )
            if not budget:
                return f"No budget found for '{category.name}'."

            # 3. Snapshot
            snapshot = {
                "amount": str(budget.amount),
                "period": budget.period,
            }

            # 4. Build update with only provided fields
            update_kwargs = {}
            if amount is not None:
                update_kwargs["amount"] = Decimal(str(amount))
            if period is not None and period in ("monthly", "yearly"):
                update_kwargs["period"] = period

            update_data = BudgetUpdate(**update_kwargs)

            # 5. Apply update
            updated_budget = budget_service.update_budget(budget.id, update_data, user_id, db)

            # 6. Store last action
            session_store.set_last_action(
                session_key,
                {
                    "type": "budget_updated",
                    "resource_type": "budget",
                    "resource_id": str(budget.id),
                    "undo_data": snapshot,
                },
            )

            new_period = updated_budget.period
            return (
                f"Updated {category.name} budget to "
                f"₹{float(updated_budget.amount):,.2f}/{new_period.replace('ly', '')}"
            )

        except Exception as e:
            return f"Failed to edit budget: {str(e)}"

    return edit_budget
