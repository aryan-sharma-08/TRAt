import os
from sqlmodel import SQLModel, create_engine, Session

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///tracker.db")
if DATABASE_URL.startswith("postgres://") or DATABASE_URL.startswith("postgresql://"):
    scheme, rest = DATABASE_URL.split("://", 1)
    if "@" in rest:
        creds, host_part = rest.rsplit("@", 1)
        if ":" in creds:
            username, password = creds.split(":", 1)
            import urllib.parse
            encoded_password = urllib.parse.quote_plus(password)
            rest = f"{username}:{encoded_password}@{host_part}"
    DATABASE_URL = f"postgresql://{rest}"

# connect_args={"check_same_thread": False} is required only for SQLite
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
