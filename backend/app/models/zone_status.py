from datetime import datetime
from sqlalchemy import Integer, String, Float, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ZoneStatus(Base):
    __tablename__ = "zone_status"

    id: Mapped[int] = mapped_column(primary_key=True)

    zone_id: Mapped[int] = mapped_column(
        Integer,
        unique=True,
        nullable=False,
        index=True
    )

    risk_level: Mapped[str] = mapped_column(
        String(20),  # low / medium / high
        nullable=False
    )

    risk_score: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
