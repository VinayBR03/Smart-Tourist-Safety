import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.core.database import Base, get_db
from app.core.config import settings
from app.main import app


# =========================================================
# FORCE TEST ENVIRONMENT (CRITICAL)
# =========================================================

@pytest.fixture(scope="session", autouse=True)
def force_test_environment():
    """
    Ensure testing mode disables:
    - background workers
    - engine disposal
    - kafka/redis startup
    """
    settings.ENVIRONMENT = "testing"
    settings.ENABLE_KAFKA = False
    settings.ENABLE_REDIS = False
    yield


# =========================================================
# TEST DATABASE (PostgreSQL)
# =========================================================

TEST_DATABASE_URL = (
    "postgresql+psycopg2://tourist_user:strongpassword"
    "@localhost:5432/tourist_safety_test"
)

engine = create_engine(TEST_DATABASE_URL)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


# =========================================================
# CREATE TABLES ONCE PER TEST SESSION
# =========================================================

@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


# =========================================================
# DB SESSION (ROLLBACK AFTER EACH TEST)
# =========================================================

@pytest.fixture()
def db_session():
    connection = engine.connect()
    transaction = connection.begin()

    session = TestingSessionLocal(bind=connection)

    try:
        yield session
    finally:
        session.close()

        if transaction.is_active:
            transaction.rollback()

        connection.close()


# =========================================================
# OVERRIDE get_db DEPENDENCY
# =========================================================

@pytest.fixture()
def client(db_session):

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


# =========================================================
# USER FACTORY FIXTURE
# =========================================================

@pytest.fixture()
def create_user(db_session):
    from app.models.user import User
    from app.core.enums import UserRole
    from app.core.security import hash_password

    def _create_user(
        email="test@example.com",
        password="TestPassword123!",
        role=UserRole.TOURIST,
        is_active=True,
        is_verified=True,
        token_version=0,
    ):
        user = User(
            email=email.lower(),
            password_hash=hash_password(password),
            role=role,
            is_active=is_active,
            is_verified=is_verified,
            token_version=token_version,
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    return _create_user


# =========================================================
# AUTH HEADER FIXTURES
# =========================================================

@pytest.fixture()
def auth_headers(create_user):
    from app.core.security import create_access_token

    user = create_user()

    token = create_access_token(
        user_id=user.id,
        role=user.role.value,
        token_version=user.token_version,
    )

    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def authority_headers(create_user):
    from app.core.security import create_access_token
    from app.core.enums import UserRole

    user = create_user(
        email="authority@example.com",
        role=UserRole.AUTHORITY,
    )

    token = create_access_token(
        user_id=user.id,
        role=user.role.value,
        token_version=user.token_version,
    )

    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def admin_headers(create_user):
    from app.core.security import create_access_token
    from app.core.enums import UserRole

    user = create_user(
        email="admin@example.com",
        role=UserRole.ADMIN,
    )

    token = create_access_token(
        user_id=user.id,
        role=user.role.value,
        token_version=user.token_version,
    )

    return {"Authorization": f"Bearer {token}"}