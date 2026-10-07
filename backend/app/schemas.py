from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from app.models import UserRole, InterviewStatus

# Auth Schemas
class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: UserRole

class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    email: str
    full_name: str
    role: str

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

# Profile Schemas
class CandidateProfileUpdate(BaseModel):
    phone: Optional[str] = None
    headline: Optional[str] = None
    skills: Optional[str] = None
    experience_years: Optional[float] = 0.0

class ResumeResponse(BaseModel):
    id: int
    original_filename: str
    file_size_bytes: int
    file_type: str
    upload_status: str
    uploaded_at: datetime

    class Config:
        from_attributes = True

class CandidateProfileResponse(BaseModel):
    id: int
    user_id: int
    phone: Optional[str]
    headline: Optional[str]
    skills: Optional[str]
    experience_years: float
    resumes: List[ResumeResponse] = []

    class Config:
        from_attributes = True

# Job Description Schemas
class JobDescriptionCreate(BaseModel):
    title: str
    role_category: str
    description_text: str
    requirements: Optional[str] = None

class JobDescriptionResponse(BaseModel):
    id: int
    title: str
    role_category: str
    description_text: str
    requirements: Optional[str]
    created_by: int
    created_at: datetime

    class Config:
        from_attributes = True

# Interview Schemas
class InterviewCreate(BaseModel):
    title: str
    job_role: str
    candidate_id: int
    job_description_id: Optional[int] = None
    scheduled_time: datetime
    notes: Optional[str] = None

class InterviewResponse(BaseModel):
    id: int
    title: str
    job_role: str
    interviewer_id: int
    interviewer_name: Optional[str] = None
    candidate_id: int
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    job_description_id: Optional[int] = None
    job_description_title: Optional[str] = None
    scheduled_time: datetime
    status: str
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
