from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router
from core.settings import settings


# =========================================================
# Lifespan — preload models at startup so the first
# inference request is not penalised by cold load time.
# =========================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    from model_registry import model_registry
    model_registry.load_all()
    yield
    # Clean shutdown — release model memory
    model_registry.unload_all()


# =========================================================
# Application Factory
# =========================================================

def create_app() -> FastAPI:

    app = FastAPI(
        title="Smart Tourist Safety AI Engine",
        version=settings.SERVICE_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # CORS — only the backend service needs to call this
    # AI engine directly. Restrict to backend origin.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:8000",       # backend local dev
            "http://backend:8000",         # backend in docker-compose
        ],
        allow_credentials=False,
        allow_methods=["POST", "GET"],
        allow_headers=["Authorization", "Content-Type"],
    )

    app.include_router(router)

    return app


# =========================================================
# App Instance
# =========================================================

app = create_app()