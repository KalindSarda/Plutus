import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryUpdate


def list_categories(user_id: uuid.UUID, db: Session) -> list[Category]:
    """Returns global defaults + user's custom categories."""
    return (
        db.query(Category)
        .filter((Category.user_id == user_id) | (Category.user_id == None))
        .order_by(Category.is_default.desc(), Category.name)
        .all()
    )


def create_category(data: CategoryCreate, user_id: uuid.UUID, db: Session) -> Category:
    if data.parent_id:
        parent = db.query(Category).filter(
            Category.id == data.parent_id,
            (Category.user_id == user_id) | (Category.user_id == None),
        ).first()
        if not parent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent category not found")

    category = Category(user_id=user_id, is_default=False, **data.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def update_category(cat_id: uuid.UUID, data: CategoryUpdate, user_id: uuid.UUID, db: Session) -> Category:
    cat = db.query(Category).filter(Category.id == cat_id, Category.user_id == user_id).first()
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    if cat.is_default:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit global default categories")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(cat, field, value)
    db.commit()
    db.refresh(cat)
    return cat


def delete_category(cat_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> None:
    cat = db.query(Category).filter(Category.id == cat_id, Category.user_id == user_id).first()
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    if cat.is_default:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete global default categories")
    db.delete(cat)
    db.commit()
