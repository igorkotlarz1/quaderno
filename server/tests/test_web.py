"""Serving the built app (M3): the service worker and the manifest must never be cached stale."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import mount_web


def make_client(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app.js").write_text("console.log(1)")
    (tmp_path / "index.html").write_text("<!doctype html><title>Quadernote</title>")
    (tmp_path / "sw.js").write_text("self.addEventListener('fetch', () => {})")
    (tmp_path / "manifest.webmanifest").write_text('{"name": "Quadernote"}')
    app = FastAPI()
    mount_web(app, tmp_path)
    return TestClient(app)


def test_service_worker_and_manifest_are_revalidated(tmp_path):
    c = make_client(tmp_path)
    sw = c.get("/sw.js")
    assert sw.status_code == 200
    assert sw.headers["cache-control"] == "no-cache"
    assert "javascript" in sw.headers["content-type"]
    m = c.get("/manifest.webmanifest")
    assert m.headers["content-type"].startswith("application/manifest+json")
    assert m.headers["cache-control"] == "no-cache"


def test_unknown_paths_get_the_app_and_files_outside_stay_hidden(tmp_path):
    c = make_client(tmp_path)
    assert "Quadernote" in c.get("/lekcja/123").text
    assert "Quadernote" in c.get("/../../etc/passwd").text
    assert c.get("/assets/app.js").status_code == 200
