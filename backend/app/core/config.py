import os
from typing import Optional
from urllib.parse import quote_plus

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):

    # =========================================================
    # APPLICATION
    # =========================================================

    PROJECT_NAME: str = "Smart Tourist Safety System"
    ENVIRONMENT: str
    DEBUG: bool = False
    ALLOWED_ORIGINS: str = "*"

    # =========================================================
    # DATABASE
    # =========================================================

    DATABASE_URL: str

    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 5
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800
    DB_STATEMENT_TIMEOUT_MS: int = 5000

    # =========================================================
    # INTERNAL
    # =========================================================

    INTERNAL_SERVICE_TOKEN: str

    # =========================================================
    # FEATURE TOGGLES
    # =========================================================

    ENABLE_REDIS: bool = False
    ENABLE_KAFKA: bool = False
    ENABLE_CELERY: bool = False
    ENABLE_S3: bool = False
    ENABLE_PUSH: bool = False
    ENABLE_SMS: bool = False
    ENABLE_RATE_LIMITER: bool = False
    ENABLE_WEBSOCKETS: bool = True

    # =========================================================
    # ML ENGINE
    # =========================================================

    ML_ENGINE_ENABLED: bool = False
    ML_ENGINE_URL: Optional[str] = None
    ML_ENGINE_TIMEOUT_SECONDS: int = 3

    # =========================================================
    # RISK ENGINE
    # =========================================================

    RISK_INCIDENT_WEIGHT: float = 0.5
    RISK_SOS_WEIGHT: float = 0.3
    RISK_DENSITY_WEIGHT: float = 0.2
    RISK_DENSITY_NORMALIZER: int = 50

    # =========================================================
    # INCIDENT CONFIG
    # =========================================================

    INCIDENT_SLA_MINUTES: int = 30
    INCIDENT_AUTO_CLOSE_DAYS: int = 7

    # =========================================================
    # JWT
    # =========================================================

    JWT_SECRET_KEY: str
    JWT_REFRESH_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    TOKEN_ROTATION_ENABLED: bool = True

    # =========================================================
    # SECURITY
    # =========================================================

    BCRYPT_ROUNDS: int = 12

    # =========================================================
    # EMAIL
    # =========================================================

    SMTP_HOST: str
    SMTP_PORT: int = 587
    SMTP_USER: str
    SMTP_PASSWORD: str
    SMTP_FROM: str
    SMTP_USE_TLS: bool = True

    # =========================================================
    # REDIS
    # =========================================================

    REDIS_HOST: str
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: Optional[str] = None
    REDIS_SSL: bool = False

    # =========================================================
    # KAFKA
    # =========================================================

    KAFKA_BOOTSTRAP_SERVERS: Optional[str] = None

    # =========================================================
    # CELERY
    # =========================================================

    CELERY_BROKER_URL: Optional[str] = None
    CELERY_RESULT_BACKEND: Optional[str] = None

    CELERY_TASK_TIME_LIMIT: int = 600
    CELERY_TASK_SOFT_TIME_LIMIT: int = 540
    CELERY_MAX_TASKS_PER_CHILD: int = 100
    CELERY_WORKER_PREFETCH_MULTIPLIER: int = 1

    # =========================================================
    # S3
    # =========================================================

    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: Optional[str] = None
    AWS_S3_BUCKET: Optional[str] = None

    # =========================================================
    # MEDIA UPLOAD LIMITS
    # =========================================================

    MAX_PROFILE_PHOTO_BYTES: int = 5 * 1024 * 1024        # 5 MB
    MAX_INCIDENT_MEDIA_BYTES: int = 50 * 1024 * 1024      # 50 MB

    MAX_MEDIA_PER_INCIDENT: int = 20
    MEDIA_UPLOAD_RATE_LIMIT: int = 20
    MEDIA_UPLOAD_RATE_WINDOW_SECONDS: int = 60

    # =========================================================
    # PUSH
    # =========================================================

    FCM_SERVER_KEY: Optional[str] = None
    FCM_SEND_URL: str = "https://fcm.googleapis.com/fcm/send"

    # =========================================================
    # SMS
    # =========================================================

    SMS_PROVIDER_URL: Optional[str] = None
    SMS_ACCOUNT_SID: Optional[str] = None
    SMS_AUTH_TOKEN: Optional[str] = None
    SMS_FROM_NUMBER: Optional[str] = None

    # =========================================================
    # ACCOUNT LIFECYCLE
    # =========================================================

    ACCOUNT_DELETION_ENABLED: bool = True
    ACCOUNT_DELETION_GRACE_DAYS: int = 30
    ACCOUNT_DELETION_BATCH_SIZE: int = 100

    # =========================================================
    # DEVICE CONFIG
    # =========================================================

    DEVICE_HEARTBEAT_RATE_LIMIT: int = 120
    LOW_BATTERY_THRESHOLD: int = 20
    DEVICE_ALERT_COOLDOWN_MINUTES: int = 30
    DEVICE_OFFLINE_THRESHOLD_MINUTES: int = 5

    # =========================================================
    # GEOFENCE CONFIG
    # =========================================================

    DEFAULT_ZONE_PROXIMITY_RADIUS: int = 50
    MAX_ZONE_PROXIMITY_RADIUS: int = 500

    # =========================================================
    # HEALTH CONFIG
    # =========================================================

    HEALTH_ALERT_COOLDOWN_MINUTES: int = 10
    HEART_RATE_HIGH: int = 130
    HEART_RATE_LOW: int = 40
    SPO2_LOW: int = 92
    TEMP_HIGH: float = 38.5

    # =========================================================
    # VALIDATORS
    # =========================================================

    @field_validator("ENVIRONMENT")
    @classmethod
    def validate_environment(cls, value: str) -> str:
        allowed = {"development", "staging", "production", "testing"}
        if value not in allowed:
            raise ValueError(f"ENVIRONMENT must be one of {allowed}")
        return value

    @field_validator("JWT_SECRET_KEY", "JWT_REFRESH_SECRET_KEY")
    @classmethod
    def validate_secret_strength(cls, value: str) -> str:
        if len(value) < 32:
            raise ValueError("JWT secrets must be at least 32 characters long")
        return value

    @model_validator(mode="after")
    def validate_ml_config(self):
        if self.ML_ENGINE_ENABLED:
            if not self.ML_ENGINE_URL:
                raise ValueError("ML_ENGINE_URL required when ML_ENGINE_ENABLED=True")
            if self.ML_ENGINE_TIMEOUT_SECONDS < 1:
                raise ValueError("ML_ENGINE_TIMEOUT_SECONDS must be >= 1")
        return self

    @model_validator(mode="after")
    def validate_risk_engine_config(self):
        total_weight = (
            self.RISK_INCIDENT_WEIGHT
            + self.RISK_SOS_WEIGHT
            + self.RISK_DENSITY_WEIGHT
        )

        if total_weight <= 0:
            raise ValueError("Risk weights must be positive")

        if self.RISK_DENSITY_NORMALIZER < 1:
            raise ValueError("RISK_DENSITY_NORMALIZER must be >= 1")

        return self

    @model_validator(mode="after")
    def validate_external_services(self):

        if self.ENABLE_REDIS and not self.REDIS_HOST:
            raise ValueError("REDIS_HOST required when ENABLE_REDIS=True")

        if self.ENABLE_KAFKA and not self.KAFKA_BOOTSTRAP_SERVERS:
            raise ValueError("KAFKA_BOOTSTRAP_SERVERS required when ENABLE_KAFKA=True")

        if self.ENABLE_CELERY and not self.CELERY_BROKER_URL:
            raise ValueError("CELERY_BROKER_URL required when ENABLE_CELERY=True")

        if self.ENABLE_S3:
            if not all([
                self.AWS_ACCESS_KEY_ID,
                self.AWS_SECRET_ACCESS_KEY,
                self.AWS_REGION,
                self.AWS_S3_BUCKET,
            ]):
                raise ValueError("S3 credentials required when ENABLE_S3=True")

        if self.ENABLE_PUSH and not self.FCM_SERVER_KEY:
            raise ValueError("FCM_SERVER_KEY required when ENABLE_PUSH=True")

        if self.ENABLE_SMS:
            if not all([
                self.SMS_PROVIDER_URL,
                self.SMS_ACCOUNT_SID,
                self.SMS_AUTH_TOKEN,
            ]):
                raise ValueError("SMS credentials required when ENABLE_SMS=True")

        return self

    # =========================================================
    # COMPUTED
    # =========================================================

    @property
    def redis_url(self) -> str:
        password_part = (
            f":{quote_plus(self.REDIS_PASSWORD)}@"
            if self.REDIS_PASSWORD
            else ""
        )
        protocol = "rediss" if self.REDIS_SSL else "redis"
        return f"{protocol}://{password_part}{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    # =========================================================
    # MODEL CONFIG
    # =========================================================

    model_config = {
        "env_file": ".env.local",
        "case_sensitive": True,
    }


settings = Settings()