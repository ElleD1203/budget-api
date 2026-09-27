import uuid
from datetime import datetime, timezone

from sqlmodel import SQLModel, Field


class Transaction(SQLModel, table=True):
    __tablename__ = "transactions"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False,
    )

    user_id: int = Field(
        index=True,
    )

    date: str
    merchant: str
    amount: float
    transaction_type: str

    created_at: datetime = Field(
        default_factory=datetime.utcnow,
    )

class User(SQLModel, table=True):

    __tablename__ = "users"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
    )

    email: str = Field(
        index=True,
        unique=True,
        max_length=320,
    )

    display_name: str

    password_hash: str

    is_superuser: bool = Field(
        default=False,
    )

    is_active: bool = Field(
        default=True,
    )

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
    )