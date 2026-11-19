from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Read from environment variables (or .env). Nothing secret has a default."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./quaderno-dev.db"
    # Built frontend (web/dist). When it exists, the API serves the app on the same origin.
    web_dist: Path = Path(__file__).resolve().parents[2] / "web" / "dist"

    # M4: Claude API. Without a key the app keeps the manual "copy the prompt" flow.
    anthropic_api_key: str = ""
    llm_lesson_model: str = "claude-haiku-5-5"  # cheap fixes: accents, NULLs, pos/lemma, verb forms
    llm_week_model: str = "claude-sonnet-5-5"  # weekly CEFR estimate: needs more judgement
    # A deterministic stand-in for the API, for the gate test and CI only. Never set it on the server.
    llm_fake: bool = False


settings = Settings()
