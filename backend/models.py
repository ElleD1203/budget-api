import uuid
from datetime import datetime

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