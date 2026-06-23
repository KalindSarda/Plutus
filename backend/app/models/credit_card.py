import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import String, Boolean, Numeric, DateTime, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class CreditCard(Base):
    __tablename__ = "credit_cards"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    bank_name: Mapped[str] = mapped_column(String(255), nullable=False)
    credit_limit: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    current_outstanding: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    available_limit: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    billing_cycle_day: Mapped[int] = mapped_column(Integer, nullable=False)
    due_day: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.utcnow()
    )

    user = relationship("User", back_populates="credit_cards")
    transactions = relationship("Transaction", back_populates="credit_card")
    statements = relationship(
        "CreditCardStatement", back_populates="credit_card", cascade="all, delete-orphan"
    )
