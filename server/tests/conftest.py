"""Tests run against TEST_DATABASE_URL (Postgres in CI/compose) or a temporary SQLite file.
The schema is built by the real Alembic migration, so the migration is tested too."""

import os

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker


@pytest.fixture()
def client(tmp_path, monkeypatch):
    url = os.environ.get("TEST_DATABASE_URL") or f"sqlite:///{tmp_path / 'test.db'}"
    monkeypatch.setattr("app.settings.settings.database_url", url)

    from app import db as dbmod
    from app.main import app

    cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(os.path.dirname(__file__), "..", "migrations"))
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")

    engine = dbmod.make_engine(url)
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)

    def override():
        with session_factory() as s:
            yield s

    app.dependency_overrides[dbmod.get_session] = override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    engine.dispose()
