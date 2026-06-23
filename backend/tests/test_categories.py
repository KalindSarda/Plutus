"""Category endpoint tests."""

import uuid
from app.models.category import Category


def _seed_default_category(db) -> Category:
    """Insert a single global default category into the test DB."""
    cat = Category(
        id=uuid.uuid4(),
        user_id=None,
        name="Groceries",
        type="expense",
        is_default=True,
    )
    db.add(cat)
    db.commit()
    return cat


def test_list_returns_global_defaults(client, auth_headers, db):
    """GET /api/categories should include global default categories."""
    _seed_default_category(db)

    resp = client.get("/api/categories", headers=auth_headers)
    assert resp.status_code == 200
    categories = resp.json()
    defaults = [c for c in categories if c["is_default"] is True]
    assert len(defaults) >= 1
    assert any(c["name"] == "Groceries" for c in defaults)


def test_user_cannot_delete_default_category(client, auth_headers, db):
    """DELETE on a global default category must return 404 (not found for this user)."""
    default_cat = _seed_default_category(db)

    resp = client.delete(f"/api/categories/{default_cat.id}", headers=auth_headers)
    # The service filters by user_id, so global (user_id=None) won't match -> 404
    assert resp.status_code == 404
