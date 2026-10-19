import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from app.database import engine
from app.rate_limit import limiter
from app.routers import auth, billing, chat, folders, insights, saved_items

load_dotenv()

# Without this, the root logger defaults to WARNING with no handler attached,
# so every logger.info() (and even logger.warning()) call anywhere in the app
# -- including in the ingestion pipeline -- is silently dropped rather than
# reaching Render's (or any) log viewer. Discovered while debugging a worker
# crash that produced zero log output even at points that should have logged.
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Comma-separated in .env so each environment (local dev, Vercel, a Capacitor app's
# origin) sets its own list without touching code. Falls back to local dev defaults
# so nothing breaks if the var isn't set yet.
_default_origins = "http://localhost:3000,http://localhost:3001"
CORS_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ORIGINS", _default_origins).split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(saved_items.router)
app.include_router(folders.router)
app.include_router(insights.router)
app.include_router(chat.router)
app.include_router(billing.router)

@app.get("/health")
def health_check():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}
