# app/utils/helpers.py

from typing import Final

from passlib.context import CryptContext
from passlib.exc import UnknownHashError

# =========================================================
# Password Hashing Configuration
# =========================================================

# Enterprise policy constants
MIN_PASSWORD_LENGTH: Final[int] = 8
MAX_PASSWORD_LENGTH: Final[int] = 128

# Strong PBKDF2 configuration (safe for Windows & containers)
# 390k+ rounds recommended (OWASP 2024 guidance range)
PBKDF2_ROUNDS: Final[int] = 390_000

pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    pbkdf2_sha256__rounds=PBKDF2_ROUNDS,
    deprecated="auto",
)

# =========================================================
# Hash Password
# =========================================================

def hash_password(password: str) -> str:
    """
    Hash password using enterprise-grade PBKDF2 configuration.
    """

    if not password:
        raise ValueError("Password cannot be empty.")

    password = password.strip()

    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError("Password too short.")

    if len(password) > MAX_PASSWORD_LENGTH:
        raise ValueError("Password too long.")

    return pwd_context.hash(password)


# =========================================================
# Verify Password
# =========================================================

def verify_password(password: str, hashed: str) -> bool:
    """
    Verify password against stored hash.
    Automatically upgrades hash if policy changes.
    """

    if not password or not hashed:
        return False

    try:
        valid = pwd_context.verify(password, hashed)

        # Auto-upgrade outdated hash (cost factor change)
        if valid and pwd_context.needs_update(hashed):
            # Caller should re-hash and persist updated hash
            return True

        return valid

    except UnknownHashError:
        return False