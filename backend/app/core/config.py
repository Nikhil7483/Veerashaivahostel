import os
from typing import List, Union, Optional
from pydantic_settings import BaseSettings
from pydantic import field_validator

class Settings(BaseSettings):
    PROJECT_NAME: str = "Smart Hostel Management & Problem Resolution System"
    API_V1_STR: str = "/api/v1"
    
    ENVIRONMENT: str = "production"
    
    MONGODB_URI: str = os.getenv(
        "MONGODB_URI",
        "mongodb+srv://nikhilnikki74831_db_user:Hostel2026@cluster0.mpafhmb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
    )
    MONGO_URI: Optional[str] = None
    DATABASE_NAME: str = "smart_hostel"
    
    JWT_SECRET_KEY: str = "smart_hostel_super_secure_jwt_secret_key_2026_production_grade"
    JWT_SECRET: Optional[str] = None
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    UPLOAD_DIRECTORY: str = "backend/uploads"
    
    CORS_ORIGINS: Union[List[str], str] = [
        "https://veerashaivahostel.run.place",
        "https://veerashaivahostel.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ]
    
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v):
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, str) and v.startswith("["):
            import json
            try:
                return json.loads(v)
            except Exception:
                return [v]
        return v

    def model_post_init(self, __context):
        env_uri = (
            os.environ.get("MONGODB_URI")
            or os.environ.get("MONGO_URI")
            or os.environ.get("MONGODB_URL")
            or os.environ.get("MONGO_URL")
            or self.MONGO_URI
        )
        if env_uri:
            self.MONGODB_URI = env_uri

        env_jwt = (
            os.environ.get("JWT_SECRET")
            or os.environ.get("JWT_SECRET_KEY")
            or self.JWT_SECRET
        )
        if env_jwt:
            self.JWT_SECRET_KEY = env_jwt

    class Config:
        case_sensitive = False
        env_file = ".env"
        extra = "allow"

settings = Settings()

# Ensure uploads directory exists
os.makedirs(settings.UPLOAD_DIRECTORY, exist_ok=True)
