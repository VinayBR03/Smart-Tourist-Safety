from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router


# =========================================================
# Application Factory
# =========================================================

def create_app() -> FastAPI:

    app = FastAPI(
        title="Smart Tourist Safety AI Engine",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # =========================================================
    # CORS Middleware
    # =========================================================


    app.include_router(router)

    return app


# =========================================================
# App Instance
# =========================================================

app = create_app()