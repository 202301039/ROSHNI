from pydantic import computed_field
from pydantic_settings import BaseSettings

from .env import load_environment

load_environment()


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    GOOGLE_REDIRECT_URI: str | None = None
    FRONTEND_REDIRECT_URL: str

    # Accept comma-separated string via env; keep as raw string to avoid JSON decode on empty values.
    ALLOWED_ORIGINS: str | None = None

    @computed_field
    @property
    def allowed_origins_list(self) -> list[str]:
        if not self.ALLOWED_ORIGINS:
            return []
        return [origin.strip().rstrip("/") for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]


settings = Settings()
