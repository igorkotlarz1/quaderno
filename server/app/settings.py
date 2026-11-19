from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Read from environment variables (or .env). Nothing secret has a default."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./quaderno-dev.db"
    # Built frontend (web/dist). When it exists, the API serves the app on the same origin.
    web_dist: Path = Path(__file__).resolve().parents[2] / "web" / "dist"


settings = Settings()
