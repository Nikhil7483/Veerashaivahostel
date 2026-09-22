from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import os
import logging

from app.core.config import settings
from app.core.limiter import limiter
from app.database.connection import connect_to_mongo, close_mongo_connection, get_database

# Configure standard structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("smart_hostel")

# Import routers
from app.api.v1.auth import router as auth_router
from app.api.v1.students import router as students_router
from app.api.v1.rooms import router as rooms_router
from app.api.v1.attendance import router as attendance_router
from app.api.v1.leaves import router as leaves_router
from app.api.v1.cleaning import router as cleaning_router
from app.api.v1.complaints import router as complaints_router
from app.api.v1.maintenance import router as maintenance_router
from app.api.v1.mess import router as mess_router
from app.api.v1.visitors import router as visitors_router
from app.api.v1.lost_found import router as lost_found_router
from app.api.v1.emergency import router as emergency_router
from app.api.v1.announcements import router as announcements_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.reports import router as reports_router
from app.api.v1.audit_logs import router as audit_logs_router
from app.api.v1.food import router as food_router
from app.api.v1.food_allocations import router as food_allocations_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_mongo()
    yield
    # Shutdown
    await close_mongo_connection()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan
)

# Attach rate limiter state and exception handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Priority 2: Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

# Priority 1: Secure Configurable CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads static directory for documents
os.makedirs(settings.UPLOAD_DIRECTORY, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIRECTORY), name="uploads")

# Include API Routers
v1 = settings.API_V1_STR
app.include_router(auth_router, prefix=v1)
app.include_router(students_router, prefix=v1)
app.include_router(rooms_router, prefix=v1)
app.include_router(attendance_router, prefix=v1)
app.include_router(leaves_router, prefix=v1)
app.include_router(cleaning_router, prefix=v1)
app.include_router(complaints_router, prefix=v1)
app.include_router(maintenance_router, prefix=v1)
app.include_router(mess_router, prefix=v1)
app.include_router(food_router, prefix=v1)
app.include_router(food_router, prefix="/api")  # Direct /api/food support
app.include_router(food_allocations_router, prefix=v1)
app.include_router(food_allocations_router, prefix="/api")  # Direct /api/food-allocation support
app.include_router(visitors_router, prefix=v1)
app.include_router(lost_found_router, prefix=v1)
app.include_router(emergency_router, prefix=v1)
app.include_router(announcements_router, prefix=v1)
app.include_router(notifications_router, prefix=v1)
app.include_router(analytics_router, prefix=v1)
app.include_router(reports_router, prefix=v1)
app.include_router(audit_logs_router, prefix=v1)

# Priority 5: Global Exception Handler for Sanitized Production Errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

# Root endpoint for platform health and keepalive
@app.get("/")
@app.head("/")
async def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": "1.0.0",
        "docs": f"{settings.API_V1_STR}/docs"
    }

# Priority 10: Health Check with MongoDB Verification
@app.get("/health")
@app.get("/api/health")
async def health_check():
    db = get_database()
    db_status = "connected"
    if db is not None:
        try:
            await db.command("ping")
        except Exception as e:
            logger.warning(f"Database health check failed: {e}")
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "status": "degraded",
                    "database": "unavailable",
                    "service": settings.PROJECT_NAME,
                    "version": "1.0.0"
                }
            )
    else:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "degraded",
                "database": "disconnected",
                "service": settings.PROJECT_NAME,
                "version": "1.0.0"
            }
        )

    return {
        "status": "healthy",
        "database": db_status,
        "service": settings.PROJECT_NAME,
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
