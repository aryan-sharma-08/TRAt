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
            creds = f"{username}:{encoded_password}"
            
        # Parse host and port to resolve to IPv4 address (Vercel has no IPv6 outbound routing)
        if "/" in host_part:
            host_and_port, dbname = host_part.split("/", 1)
            dbname_str = f"/{dbname}"
        else:
            host_and_port = host_part
            dbname_str = ""
            
        if ":" in host_and_port:
            host, port = host_and_port.split(":", 1)
            port_str = f":{port}"
        else:
            host = host_and_port
            port_str = ""
            
        import socket
        try:
            ipv4_host = socket.gethostbyname(host)
            host_and_port = f"{ipv4_host}{port_str}"
        except Exception as dns_err:
            print(f"Database DNS pre-resolve warning: {dns_err}", flush=True)
            
        rest = f"{creds}@{host_and_port}{dbname_str}"
        
    DATABASE_URL = f"postgresql://{rest}"

# connect_args={"check_same_thread": False} is required only for SQLite
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
