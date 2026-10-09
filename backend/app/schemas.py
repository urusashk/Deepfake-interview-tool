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
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    headline: Optional[str] = None
    skills: Optional[str] = None
    experience_years: Optional[float] = None
    education: Optional[List[Dict[str, Any]]] = None
    experience_details: Optional[List[str]] = None
    projects: Optional[List[Dict[str, Any]]] = None
    certifications: Optional[List[str]] = None

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
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    headline: Optional[str] = None
    skills: Optional[str] = None
    experience_years: float = 0.0
    education: Optional[List[Dict[str, Any]]] = None
    experience_details: Optional[List[str]] = None
    projects: Optional[List[Dict[str, Any]]] = None
    certifications: Optional[List[str]] = None
    resumes: List[ResumeResponse] = []

    class Config:
        from_attributes = True

# Notification Schemas
class NotificationResponse(BaseModel):
    id: int
    user_id: int
    interview_id: Optional[int] = None
    title: str
    message: str
    job_role: Optional[str] = None
    scheduled_time: Optional[datetime] = None
    interviewer_name: Optional[str] = None
    is_read: int
    email_sent: int
    created_at: datetime

    class Config:
        from_attributes = True

class NotificationMarkReadRequest(BaseModel):
    notification_ids: Optional[List[int]] = None # None means mark all as read

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
    education: Optional[List[Dict[str, Any]]] = None
    experience_details: Optional[List[str]] = None
    projects: Optional[List[Dict[str, Any]]] = None
    certifications: Optional[List[str]] = None
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

class InterviewSessionUpdateRequest(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    current_question_index: Optional[int] = None
    status: Optional[str] = None # scheduled, in_progress, completed, cancelled
    session_metadata: Optional[Dict[str, Any]] = None

class RecordingConsentRequest(BaseModel):
    consent: bool

# Phase 5 Analysis Schemas
class QuestionAnswerEvaluation(BaseModel):
    question_id: int
    question_text: str
    category: str
    difficulty: str
    transcript: str
    timestamp_start: Optional[str] = None
    timestamp_end: Optional[str] = None
    relevance_score: float # 0 to 100
    technical_score: float # 0 to 100
    completeness_score: float # 0 to 100
    average_score: float # 0 to 100
    explanation: str
    key_strengths: List[str] = []
    missing_points: List[str] = []

class ResumeClaimVerification(BaseModel):
    claim_text: str
    status: str # "consistent", "potential_inconsistency", "unsupported"
    answer_excerpt: str
    resume_evidence: Optional[str] = None
    explanation: str

class FullTranscriptEntry(BaseModel):
    speaker: str # "interviewer" or "candidate"
    speaker_name: Optional[str] = None
    text: str
    timestamp: str
    question_id: Optional[int] = None

class InterviewAnalysisResponse(BaseModel):
    id: int
    interview_id: int
    status: str # pending, processing, completed, failed
    error_message: Optional[str] = None
    overall_relevance_score: float
    overall_technical_score: float
    overall_completeness_score: float
    average_score: float
    question_evaluations: List[QuestionAnswerEvaluation] = []
    resume_claims: List[ResumeClaimVerification] = []
    full_transcript: List[FullTranscriptEntry] = []
    behaviour_analysis: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

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
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    current_question_index: int = 0
    recording_path: Optional[str] = None
    recording_consent_candidate: int = 0
    recording_consent_interviewer: int = 0
    session_metadata: Optional[Dict[str, Any]] = None
    created_at: datetime
    match_score: Optional[MatchBreakdownResponse] = None
    questions: List[InterviewQuestionResponse] = []
    analysis: Optional[InterviewAnalysisResponse] = None

    class Config:
        from_attributes = True


