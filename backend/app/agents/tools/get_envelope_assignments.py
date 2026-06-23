import uuid

from sqlalchemy.orm import Session

from app.services import envelope_service


def make_get_envelope_assignments(user_id: uuid.UUID, db: Session):
    def get_envelope_assignments() -> str:
        """Get the envelope budgeting assignments — which account or credit card is the default for each spending category."""
        try:
            envelopes = envelope_service.list_envelopes(user_id, db)

            if not envelopes:
                return (
                    "No envelope assignments set yet. "
                    "You can set one by saying 'set my default account for Food to HDFC'."
                )

            lines = []
            for e in envelopes:
                destination = e.get("account_name") or e.get("cc_name") or "Unknown"
                lines.append(f"  {e['category_name']} → {destination}")

            return "Your envelope assignments:\n" + "\n".join(lines)
        except Exception as exc:
            return f"Error retrieving envelope assignments: {exc}"

    return get_envelope_assignments
