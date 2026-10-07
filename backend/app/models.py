import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Float
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class UserRole(str, enum.Enum):
    CANDIDATE = "candidate"
    INTERVIEWER = "interviewer"

class InterviewStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    candidate_profile = relationship("CandidateProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    created_interviews = relationship("Interview", foreign_keys="[Interview.interviewer_id]", back_populates="interviewer")
    assigned_interviews = relationship("Interview", foreign_keys="[Interview.candidate_id]", back_populates="candidate")
    job_descriptions = relationship("JobDescription", back_populates="created_by_user")

class CandidateProfile(Base):
    __tablename__ = "candidate_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    phone = Column(String(50), nullable=True)
    headline = Column(String(255), nullable=True)
    skills = Column(Text, nullable=True) # Comma-separated or JSON list
    experience_years = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="candidate_profile")
    resumes = relationship("Resume", back_populates="candidate_profile", cascade="all, delete-orphan")

class Resume(Base):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, index=True)
    candidate_profile_id = Column(Integer, ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False)
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    file_type = Column(String(50), nullable=False) # pdf, docx
    upload_status = Column(String(50), default="Uploaded") # Uploaded, Verified, etc.
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    candidate_profile = relationship("CandidateProfile", back_populates="resumes")

class JobDescription(Base):
    __tablename__ = "job_descriptions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    role_category = Column(String(100), nullable=False) # e.g. Frontend Engineer, ML Engineer
    description_text = Column(Text, nullable=False)
    requirements = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    created_by_user = relationship("User", back_populates="job_descriptions")
    interviews = relationship("Interview", back_populates="job_description")

class Interview(Base):
    __tablename__ = "interviews"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    job_role = Column(String(150), nullable=False)
    interviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    candidate_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    job_description_id = Column(Integer, ForeignKey("job_descriptions.id"), nullable=True)
    scheduled_time = Column(DateTime, nullable=False)
    status = Column(Enum(InterviewStatus), default=InterviewStatus.SCHEDULED)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    interviewer = relationship("User", foreign_keys=[interviewer_id], back_populates="created_interviews")
    candidate = relationship("User", foreign_keys=[candidate_id], back_populates="assigned_interviews")
    job_description = relationship("JobDescription", back_populates="interviews")
    questions = relationship("InterviewQuestion", back_populates="interview", cascade="all, delete-orphan")
    results = relationship("InterviewResult", back_populates="interview", cascade="all, delete-orphan")

class InterviewQuestion(Base):
    """Placeholder model for questions to be generated or linked in upcoming phases"""
    __tablename__ = "interview_questions"

    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(Integer, ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False)
    question_text = Column(Text, nullable=False)
    order_index = Column(Integer, default=0)
    category = Column(String(100), default="Technical")
    created_at = Column(DateTime, default=datetime.utcnow)

    interview = relationship("Interview", back_populates="questions")

class InterviewResult(Base):
    """Placeholder model for evaluation metrics to be populated in upcoming AI phases"""
    __tablename__ = "interview_results"

    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(Integer, ForeignKey("interviews.id", ondelete="CASCADE"), unique=True, nullable=False)
    overall_score = Column(Float, nullable=True)
    feedback_summary = Column(Text, nullable=True)
    deepfake_flags_count = Column(Integer, default=0)
    behaviour_metrics_json = Column(Text, nullable=True) # Future-ready AI payload
    created_at = Column(DateTime, default=datetime.utcnow)

    interview = relationship("Interview", back_populates="results")
