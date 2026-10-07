from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any, Dict
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

# Match Breakdown Schemas
class MatchBreakdownResponse(BaseModel):
    id: Optional[int] = None
    overall_match_score: float
    skills_match_score: float
    experience_match_score: float
    education_match_score: float
    projects_match_score: float
    matching_skills: List[str] = []
    missing_skills: List[str] = []
    ai_summary: Optional[str] = None
    job_description_title: Optional[str] = None

# Profile & Resume Schemas
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
    parsed_data: Optional[Dict[str, Any]] = None
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

# Candidate with Match for Interviewer View
class CandidateMatchDetail(BaseModel):
    id: int
    full_name: str
    email: str
    created_at: datetime
    phone: Optional[str] = None
    headline: Optional[str] = None
    skills: Optional[str] = None
    experience_years: float = 0.0
    latest_resume: Optional[ResumeResponse] = None
    match_score: Optional[MatchBreakdownResponse] = None

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
    parsed_data: Optional[Dict[str, Any]] = None
    created_by: int
    created_at: datetime

    class Config:
        from_attributes = True

# Question Schemas (Phase 3)
class InterviewQuestionCreate(BaseModel):
    question_text: str
    category: Optional[str] = "Technical"
    difficulty: Optional[str] = "Medium"

class InterviewQuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    category: Optional[str] = None
    difficulty: Optional[str] = None
    order_index: Optional[int] = None

class InterviewQuestionResponse(BaseModel):
    id: int
    interview_id: int
    question_text: str
    category: str
    difficulty: str
    order_index: int
    is_custom: int
    created_at: datetime
    updated_at: Optional[datetime] = None

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
    match_score: Optional[MatchBreakdownResponse] = None
    questions: List[InterviewQuestionResponse] = []

    class Config:
        from_attributes = True
