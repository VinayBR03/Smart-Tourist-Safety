import os
from pydantic import BaseModel


class MLServiceSettings(BaseModel):

    SERVICE_NAME: str = "ai_engine"
    SERVICE_VERSION: str = "1.0.0"

    HOST: str = "0.0.0.0"
    PORT: int = 8001

    INTERNAL_TOKEN: str = os.getenv("AI_ENGINE_INTERNAL_TOKEN", "change_me")

    MODEL_AUTO_RELOAD: bool = False
    LOG_LEVEL: str = "INFO"


settings = MLServiceSettings()