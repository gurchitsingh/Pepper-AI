#!/usr/bin/env python3
import os
import sys

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set in environment")
    sys.exit(1)

engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    result = conn.execute(text("""
        SELECT id, email, name, 
               CASE WHEN hashed_password IS NOT NULL THEN 'yes' ELSE 'no' END as has_password,
               oauth_provider, oauth_provider_id, plan, created_at
        FROM users
        ORDER BY created_at DESC
    """))
    rows = result.fetchall()
    print(f"Total users: {len(rows)}")
    print("-" * 120)
    for r in rows:
        print(f"{r.id} | {r.email:<40} | name={r.name or 'N/A':<20} | pw={r.has_password} | oauth={r.oauth_provider or '-'} | plan={r.plan} | {r.created_at}")
