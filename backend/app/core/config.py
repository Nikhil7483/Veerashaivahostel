import os
from typing import List, Union, Optional
from pydantic_settings import BaseSettings
from pydantic import field_validator

class Settings(BaseSettings):
    PROJECT_NAME: str = "Smart Hostel Management & Problem Resolution System"
    API_V1_STR: str = "/api/v1"
    
    ENVIRONMENT: str = "production"
    
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGO_URI: Optional[str] = None
    DATABASE_NAME: str = "smart_hostel"
    
    JWT_SECRET_KEY: str = "smart_hostel_super_secure_jwt_secret_key_2026_production_grade"
    JWT_SECRET: Optional[str] = None
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    UPLOAD_DIRECTORY: str = "backend/uploads"
    
    CORS_ORIGINS: Union[List[str], str] = [
        "https://veerashaivahostel.run.place",
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
        if self.MONGO_URI and not self.MONGODB_URI:
            self.MONGODB_URI = self.MONGO_URI
        elif self.MONGO_URI:
            self.MONGODB_URI = self.MONGO_URI
        if self.JWT_SECRET and not self.JWT_SECRET_KEY:
            self.JWT_SECRET_KEY = self.JWT_SECRET
        elif self.JWT_SECRET:
            self.JWT_SECRET_KEY = self.JWT_SECRET

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "allow"

settings = Settings()

# Ensure uploads directory exists
os.makedirs(settings.UPLOAD_DIRECTORY, exist_ok=True)
