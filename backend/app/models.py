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
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class QuestionDifficulty(str, enum.Enum):
    EASY = "Easy"
    MEDIUM = "Medium"
    HARD = "Hard"

class QuestionCategory(str, enum.Enum):
    TECHNICAL = "Technical"
    RESUME_PROJECT = "Resume/Project"
    ROLE_SPECIFIC = "Role-Specific"
    EXPERIENCE_BASED = "Experience-Based"
    SITUATIONAL = "Situational"

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
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan", order_by="desc(Notification.created_at)")

class CandidateProfile(Base):
    __tablename__ = "candidate_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    phone = Column(String(50), nullable=True)
    headline = Column(String(255), nullable=True)
    skills = Column(Text, nullable=True) # Comma-separated or JSON list
    experience_years = Column(Float, default=0.0)
    education = Column(Text, nullable=True) # JSON array of education details
    experience_details = Column(Text, nullable=True) # JSON array of experience details
    projects = Column(Text, nullable=True) # JSON array of projects
    certifications = Column(Text, nullable=True) # JSON array of certifications
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="candidate_profile")
    resumes = relationship("Resume", back_populates="candidate_profile", cascade="all, delete-orphan")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    interview_id = Column(Integer, ForeignKey("interviews.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    job_role = Column(String(150), nullable=True)
    scheduled_time = Column(DateTime, nullable=True)
    interviewer_name = Column(String(255), nullable=True)
    is_read = Column(Integer, default=0) # 0 = unread, 1 = read
    email_sent = Column(Integer, default=0) # 0 = no/pending, 1 = sent
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")
    interview = relationship("Interview")

class Resume(Base):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, index=True)
    candidate_profile_id = Column(Integer, ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False)
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    file_type = Column(String(50), nullable=False) # pdf, docx
    upload_status = Column(String(50), default="Uploaded") # Uploaded, Parsed, Error
    
    # Phase 2: Extracted Resume Content and Structured Data (JSON)
    raw_text = Column(Text, nullable=True)
    parsed_data = Column(Text, nullable=True) # JSON: skills, education, work_experience, projects, certifications, technologies
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    candidate_profile = relationship("CandidateProfile", back_populates="resumes")
    match_scores = relationship("ResumeJobMatch", back_populates="resume", cascade="all, delete-orphan")

class JobDescription(Base):
    __tablename__ = "job_descriptions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    role_category = Column(String(100), nullable=False) # e.g. Frontend Engineer, ML Engineer
    description_text = Column(Text, nullable=False)
    requirements = Column(Text, nullable=True)
    
    # Phase 2: Structured Job Analysis Data (JSON)
    parsed_data = Column(Text, nullable=True) # JSON: required_skills, preferred_skills, experience_reqs, education_reqs, responsibilities, technologies
    
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    created_by_user = relationship("User", back_populates="job_descriptions")
    interviews = relationship("Interview", back_populates="job_description")
    match_scores = relationship("ResumeJobMatch", back_populates="job_description", cascade="all, delete-orphan")

class ResumeJobMatch(Base):
    """Phase 2: Semantic AI Match between a candidate's resume and a job description"""
    __tablename__ = "resume_job_matches"

    id = Column(Integer, primary_key=True, index=True)
    resume_id = Column(Integer, ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False)
    job_description_id = Column(Integer, ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False)
    
    overall_match_score = Column(Float, nullable=False) # 0 to 100
    skills_match_score = Column(Float, nullable=False) # 0 to 100
    experience_match_score = Column(Float, nullable=False) # 0 to 100
    education_match_score = Column(Float, nullable=False) # 0 to 100
    projects_match_score = Column(Float, nullable=False) # 0 to 100
    
    matching_skills = Column(Text, nullable=True) # JSON array of matching skills
    missing_skills = Column(Text, nullable=True) # JSON array of missing required skills
    ai_summary = Column(Text, nullable=True) # Short AI-generated candidate suitability summary
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    resume = relationship("Resume", back_populates="match_scores")
    job_description = relationship("JobDescription", back_populates="match_scores")

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
    
    # Phase 4: Room session tracking & WebRTC recording metadata
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    current_question_index = Column(Integer, default=0)
    recording_path = Column(String(500), nullable=True)
    recording_consent_candidate = Column(Integer, default=0) # 0=pending/denied, 1=consented
    recording_consent_interviewer = Column(Integer, default=0) # 0=pending/denied, 1=consented
    session_metadata = Column(Text, nullable=True) # JSON with participant events, speech/deepfake prep tags
    
    created_at = Column(DateTime, default=datetime.utcnow)

    interviewer = relationship("User", foreign_keys=[interviewer_id], back_populates="created_interviews")
    candidate = relationship("User", foreign_keys=[candidate_id], back_populates="assigned_interviews")
    job_description = relationship("JobDescription", back_populates="interviews")
    questions = relationship("InterviewQuestion", back_populates="interview", cascade="all, delete-orphan", order_by="InterviewQuestion.order_index")
    results = relationship("InterviewResult", back_populates="interview", cascade="all, delete-orphan")
    analysis = relationship("InterviewAnalysisResult", back_populates="interview", uselist=False, cascade="all, delete-orphan")

class InterviewQuestion(Base):
    """Phase 3: AI-generated & custom questions with category, difficulty, and order"""
    __tablename__ = "interview_questions"

    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(Integer, ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False)
    question_text = Column(Text, nullable=False)
    category = Column(String(100), default="Technical") # Technical, Resume/Project, Role-Specific, Experience-Based, Situational
    difficulty = Column(String(50), default="Medium") # Easy, Medium, Hard
    order_index = Column(Integer, default=0)
    is_custom = Column(Integer, default=0) # 0 for AI generated, 1 for interviewer added
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    interview = relationship("Interview", back_populates="questions")

class InterviewAnalysisResult(Base):
    """Phase 5: Speech-to-text transcript, question-wise answer analysis, and resume claim verification"""
    __tablename__ = "interview_analysis_results"

    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(Integer, ForeignKey("interviews.id", ondelete="CASCADE"), unique=True, nullable=False)
    status = Column(String(50), default="completed") # pending, processing, completed, failed
    error_message = Column(Text, nullable=True)

    # Summary metrics
    overall_relevance_score = Column(Float, default=0.0) # 0-100
    overall_technical_score = Column(Float, default=0.0) # 0-100
    overall_completeness_score = Column(Float, default=0.0) # 0-100
    average_score = Column(Float, default=0.0) # 0-100

    # Detailed question-by-question evaluations (JSON string)
    question_evaluations = Column(Text, nullable=True)

    # Resume claim verifications (JSON string)
    resume_claims = Column(Text, nullable=True)

    # Full session chronological transcript with timestamps (JSON string)
    full_transcript = Column(Text, nullable=True)

    # Phase 6: Video and Audio Behaviour Analysis metrics & timeline (JSON string)
    behaviour_metrics_json = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    interview = relationship("Interview", back_populates="analysis")

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
