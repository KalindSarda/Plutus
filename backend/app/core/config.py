from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    REFRESH_SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    INVITE_CODE: str
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "qwen/qwen3-32b"
    ALLOWED_ORIGINS: str = "http://localhost:5173"
    SESSION_TTL_MINUTES: int = 120
    COOKIE_SECURE: bool = True

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    @property
    def groq_api_key(self) -> str:
        return self.GROQ_API_KEY

    @property
    def groq_model(self) -> str:
        return self.GROQ_MODEL

    model_config = {"env_file": ".env"}


settings = Settings()
