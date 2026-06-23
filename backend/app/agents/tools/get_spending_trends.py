import uuid

from sqlalchemy.orm import Session

from app.services.report_service import get_monthly_trends


def make_get_spending_trends(user_id: uuid.UUID, db: Session):
    def get_spending_trends() -> str:
        """Get month-over-month income, expense, and savings trends for the last 6 months."""
        trends = get_monthly_trends(user_id, db, months=6)

        if not trends:
            return "No transaction history found."

        lines = ["Month-over-month trends (last 6 months):"]
        for t in trends:
            savings_sign = "+" if t["savings"] >= 0 else ""
            lines.append(
                f"  {t['month_label']}: "
                f"Income ₹{t['income']:,.2f}, "
                f"Expense ₹{t['expense']:,.2f}, "
                f"Savings {savings_sign}₹{t['savings']:,.2f}"
            )

        # Simple anomaly detection: compare last month vs 3-month average
        if len(trends) >= 2:
            last = trends[-1]
            prev_avg_expense = sum(t["expense"] for t in trends[:-1]) / (len(trends) - 1)
            if prev_avg_expense > 0:
                change_pct = float((last["expense"] - prev_avg_expense) / prev_avg_expense * 100)
                if abs(change_pct) >= 20:
                    direction = "up" if change_pct > 0 else "down"
                    lines.append(
                        f"\n⚡ Notable: Last month's expenses were {abs(change_pct):.0f}% {direction} "
                        f"vs the prior period average."
                    )

        return "\n".join(lines)

    return get_spending_trends
