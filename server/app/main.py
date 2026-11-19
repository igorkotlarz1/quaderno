from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .api import router
from .settings import settings

app = FastAPI(title="Quadernote", version="0.2.0")
app.include_router(router)

# Serve the built React app from the same origin, so the phone only needs one address.
if settings.web_dist.is_dir():
    app.mount("/assets", StaticFiles(directory=settings.web_dist / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        file = settings.web_dist / path
        if path and file.is_file() and settings.web_dist in file.resolve().parents:
            return FileResponse(file)
        return FileResponse(settings.web_dist / "index.html")
