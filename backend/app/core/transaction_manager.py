# app/core/transaction_manager.py

from contextlib import contextmanager
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.core.exceptions import InternalServerError
from app.utils.logger import get_logger


logger = get_logger(__name__)


class TransactionManager:
    """
    Enterprise transaction boundary manager.

    Guarantees:
    - Commit on success
    - Rollback on failure
    - No session poisoning
    - Safe nested transaction handling
    """

    def __init__(self, db: Session):
        self.db = db

    @contextmanager
    def transaction(self):
        """
        Usage:

        with TransactionManager(db).transaction():
            ... service logic ...
        """

        try:
            yield self.db
            self.db.commit()

        except SQLAlchemyError as e:
            logger.exception("Database transaction failed")
            self.db.rollback()
            raise InternalServerError("Database operation failed") from e

        except Exception:
            self.db.rollback()
            raise

    @contextmanager
    def nested(self):
        """
        Nested transaction using SAVEPOINT.

        Useful for:
        - Partial failure handling
        - Complex service flows
        """

        savepoint = self.db.begin_nested()

        try:
            yield self.db
            savepoint.commit()

        except Exception:
            savepoint.rollback()
            raise