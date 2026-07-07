import os
import sys
# Add backend directory to sys.path to resolve imports on serverless platforms (like Vercel)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from app.database import create_db_and_tables
from app.routers import auth, tasks, diet, study, ai

app = FastAPI(title="TRAt API", description="Task & Routine Assistant/Tracker API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_no_cache_header(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/static"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# Ensure database tables are created on module import (crucial for serverless platforms like Vercel)
try:
    create_db_and_tables()
except Exception as db_err:
    print(f"Database table creation warning: {db_err}", flush=True)

# Include API Routers
app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(diet.router)
app.include_router(study.router)
app.include_router(ai.router)

# Mount Frontend static files
# Ensure the frontend path exists relative to where main.py runs (typically backend/ folder)
frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend"))

if os.path.exists(frontend_path):
    app.mount("/static", StaticFiles(directory=frontend_path), name="static")
    
    # Catch-all route to serve index.html for SPA (React Router fallback)
    @app.get("/{catchall:path}")
    async def serve_frontend(request: Request, catchall: str):
        # Ignore api routes
        if catchall.startswith("api"):
            return JSONResponse(status_code=404, content={"detail": "Not Found"})
            
        file_path = os.path.join(frontend_path, catchall)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
            
        return FileResponse(os.path.join(frontend_path, "index.html"))
else:
    @app.get("/")
    def read_root():
        return {"message": "TRAt Backend API is running, but frontend static files were not found. Please scaffold the frontend folder."}
