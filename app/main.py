from fastapi import FastAPI
from sqlalchemy import text
from app.database import engine
from app.routers import auth, chat, saved_items

app = FastAPI()

app.include_router(auth.router)
app.include_router(saved_items.router)
app.include_router(chat.router)

@app.get("/health")
def health_check():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}