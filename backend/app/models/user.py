from sqlalchemy import Date, String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from datetime import date

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password: Mapped[str] = mapped_column(nullable=False)
    role: Mapped[str] = mapped_column(nullable=False)

    # Tourist profile fields
    full_name: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(20))
    emergency_contact: Mapped[str | None] = mapped_column(String(20))
    blood_group: Mapped[str | None] = mapped_column(nullable=True)
    medical_conditions: Mapped[str | None] = mapped_column(nullable=True)
    allergies: Mapped[str | None] = mapped_column(nullable=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(nullable=True)
    nationality: Mapped[str | None] = mapped_column(nullable=True)
