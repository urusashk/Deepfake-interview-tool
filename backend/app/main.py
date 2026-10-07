import os
import uuid
import aiofiles
from datetime import datetime
from typing import List
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import engine, get_db, SessionLocal
from app.models import (
    Base, User, CandidateProfile, Resume, JobDescription,
    Interview, InterviewQuestion, InterviewResult, UserRole, InterviewStatus
)
from app.auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, require_candidate, require_interviewer
)
from app.schemas import (
    UserRegisterRequest, UserLoginRequest, TokenResponse, UserResponse,
    CandidateProfileUpdate, CandidateProfileResponse, ResumeResponse,
    JobDescriptionCreate, JobDescriptionResponse,
    InterviewCreate, InterviewResponse
)

# Initialize database schema
Base.metadata.create_all(bind=engine)

# Upload directory setup
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads", "resumes"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(
    title="AI Interview Platform - Phase 1 Backend",
    description="Core backend for authentication, profiles, resume management, job descriptions, and interview scheduling.",
    version="1.0.0"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- SEED DATA HELPER -----------------
def init_seed_data():
    db = SessionLocal()
    try:
        # Check if users exist
        if db.query(User).count() == 0:
            # Create demo interviewer
            interviewer = User(
                email="interviewer@platform.ai",
                hashed_password=get_password_hash("password123"),
                full_name="Sarah Jenkins (Lead Tech Recruiter)",
                role=UserRole.INTERVIEWER
            )
            # Create demo candidate
            candidate = User(
                email="candidate@platform.ai",
                hashed_password=get_password_hash("password123"),
                full_name="Alex Chen",
                role=UserRole.CANDIDATE
            )
            db.add(interviewer)
            db.add(candidate)
            db.commit()
            db.refresh(interviewer)
            db.refresh(candidate)

            # Create profile for candidate
            profile = CandidateProfile(
                user_id=candidate.id,
                phone="+1 (555) 349-8821",
                headline="Senior Full-Stack & Python Engineer",
                skills="Python, FastAPI, React, TypeScript, PostgreSQL, Docker, AWS",
                experience_years=4.5
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)

            # Create sample Job Description
            jd = JobDescription(
                title="Senior AI Systems Engineer",
                role_category="Software Engineering",
                description_text="We are seeking an experienced Systems Engineer to build robust pipelines and core API microservices.",
                requirements="3+ years Python/FastAPI, Distributed Systems, SQL, Clean Architecture principles.",
                created_by=interviewer.id
            )
            db.add(jd)
            db.commit()
            db.refresh(jd)

            # Create sample interviews
            interview1 = Interview(
                title="Technical Architecture Round",
                job_role="Senior AI Systems Engineer",
                interviewer_id=interviewer.id,
                candidate_id=candidate.id,
                job_description_id=jd.id,
                scheduled_time=datetime.utcnow(),
                status=InterviewStatus.SCHEDULED,
                notes="Candidate is well versed with backend frameworks and microservices."
            )
            db.add(interview1)
            db.commit()
    finally:
        db.close()

init_seed_data()

# ----------------- AUTH ROUTING -----------------

@app.post("/api/auth/register", response_model=TokenResponse)
def register(user_in: UserRegisterRequest, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user_in.email.lower()).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = User(
        email=user_in.email.lower(),
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # If Candidate, auto-generate initial profile
    if new_user.role == UserRole.CANDIDATE:
        profile = CandidateProfile(user_id=new_user.id)
        db.add(profile)
        db.commit()

    token = create_access_token(data={"sub": new_user.email, "role": new_user.role.value})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role.value
    )

@app.post("/api/auth/login", response_model=TokenResponse)
def login(login_in: UserLoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_in.email.lower()).first()
    if not user or not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    token = create_access_token(data={"sub": user.email, "role": user.role.value})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value
    )

@app.get("/api/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# ----------------- CANDIDATE ENDPOINTS -----------------

@app.get("/api/candidate/profile", response_model=CandidateProfileResponse)
def get_candidate_profile(
    current_user: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).first()
    if not profile:
        profile = CandidateProfile(user_id=current_user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile

@app.put("/api/candidate/profile", response_model=CandidateProfileResponse)
def update_candidate_profile(
    profile_data: CandidateProfileUpdate,
    current_user: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).first()
    if not profile:
        profile = CandidateProfile(user_id=current_user.id)
        db.add(profile)
    
    if profile_data.phone is not None:
        profile.phone = profile_data.phone
    if profile_data.headline is not None:
        profile.headline = profile_data.headline
    if profile_data.skills is not None:
        profile.skills = profile_data.skills
    if profile_data.experience_years is not None:
        profile.experience_years = profile_data.experience_years
    
    db.commit()
    db.refresh(profile)
    return profile

@app.post("/api/candidate/resume/upload", response_model=ResumeResponse)
async def upload_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    # Validate extension
    file_ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if file_ext not in ["pdf", "docx"]:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Please upload a PDF or DOCX resume."
        )
    
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).first()
    if not profile:
        profile = CandidateProfile(user_id=current_user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)

    # Save to disk securely with UUID prefix
    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    file_size = 0
    async with aiofiles.open(file_path, "wb") as out_file:
        while content := await file.read(1024 * 1024): # 1MB chunks
            file_size += len(content)
            await out_file.write(content)

    # Save metadata to DB
    resume = Resume(
        candidate_profile_id=profile.id,
        original_filename=file.filename,
        stored_filename=unique_filename,
        file_path=file_path,
        file_size_bytes=file_size,
        file_type=file_ext,
        upload_status="Uploaded",
        uploaded_at=datetime.utcnow()
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)

    return resume

@app.get("/api/candidate/interviews", response_model=List[InterviewResponse])
def get_candidate_interviews(
    current_user: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    interviews = (
        db.query(Interview)
        .filter(Interview.candidate_id == current_user.id)
        .order_by(desc(Interview.scheduled_time))
        .all()
    )
    
    results = []
    for it in interviews:
        results.append(
            InterviewResponse(
                id=it.id,
                title=it.title,
                job_role=it.job_role,
                interviewer_id=it.interviewer_id,
                interviewer_name=it.interviewer.full_name if it.interviewer else None,
                candidate_id=it.candidate_id,
                candidate_name=it.candidate.full_name if it.candidate else None,
                candidate_email=it.candidate.email if it.candidate else None,
                job_description_id=it.job_description_id,
                job_description_title=it.job_description.title if it.job_description else None,
                scheduled_time=it.scheduled_time,
                status=it.status.value,
                notes=it.notes,
                created_at=it.created_at
            )
        )
    return results

# ----------------- INTERVIEWER ENDPOINTS -----------------

@app.get("/api/interviewer/candidates", response_model=List[UserResponse])
def get_all_candidates(
    current_user: User = Depends(require_interviewer),
    db: Session = Depends(get_db)
):
    candidates = db.query(User).filter(User.role == UserRole.CANDIDATE).all()
    return candidates

@app.get("/api/interviewer/job-descriptions", response_model=List[JobDescriptionResponse])
def get_job_descriptions(
    current_user: User = Depends(require_interviewer),
    db: Session = Depends(get_db)
):
    return db.query(JobDescription).order_by(desc(JobDescription.created_at)).all()

@app.post("/api/interviewer/job-descriptions", response_model=JobDescriptionResponse)
def create_job_description(
    jd_in: JobDescriptionCreate,
    current_user: User = Depends(require_interviewer),
    db: Session = Depends(get_db)
):
    new_jd = JobDescription(
        title=jd_in.title,
        role_category=jd_in.role_category,
        description_text=jd_in.description_text,
        requirements=jd_in.requirements,
        created_by=current_user.id
    )
    db.add(new_jd)
    db.commit()
    db.refresh(new_jd)
    return new_jd

@app.post("/api/interviewer/interviews", response_model=InterviewResponse)
def create_interview(
    interview_in: InterviewCreate,
    current_user: User = Depends(require_interviewer),
    db: Session = Depends(get_db)
):
    # Verify candidate exists
    candidate = db.query(User).filter(User.id == interview_in.candidate_id, User.role == UserRole.CANDIDATE).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    new_interview = Interview(
        title=interview_in.title,
        job_role=interview_in.job_role,
        interviewer_id=current_user.id,
        candidate_id=interview_in.candidate_id,
        job_description_id=interview_in.job_description_id,
        scheduled_time=interview_in.scheduled_time,
        notes=interview_in.notes,
        status=InterviewStatus.SCHEDULED
    )
    db.add(new_interview)
    db.commit()
    db.refresh(new_interview)

    return InterviewResponse(
        id=new_interview.id,
        title=new_interview.title,
        job_role=new_interview.job_role,
        interviewer_id=new_interview.interviewer_id,
        interviewer_name=current_user.full_name,
        candidate_id=new_interview.candidate_id,
        candidate_name=candidate.full_name,
        candidate_email=candidate.email,
        job_description_id=new_interview.job_description_id,
        job_description_title=new_interview.job_description.title if new_interview.job_description else None,
        scheduled_time=new_interview.scheduled_time,
        status=new_interview.status.value,
        notes=new_interview.notes,
        created_at=new_interview.created_at
    )

@app.get("/api/interviewer/interviews", response_model=List[InterviewResponse])
def get_interviewer_interviews(
    current_user: User = Depends(require_interviewer),
    db: Session = Depends(get_db)
):
    interviews = (
        db.query(Interview)
        .filter(Interview.interviewer_id == current_user.id)
        .order_by(desc(Interview.scheduled_time))
        .all()
    )
    
    results = []
    for it in interviews:
        results.append(
            InterviewResponse(
                id=it.id,
                title=it.title,
                job_role=it.job_role,
                interviewer_id=it.interviewer_id,
                interviewer_name=it.interviewer.full_name if it.interviewer else None,
                candidate_id=it.candidate_id,
                candidate_name=it.candidate.full_name if it.candidate else None,
                candidate_email=it.candidate.email if it.candidate else None,
                job_description_id=it.job_description_id,
                job_description_title=it.job_description.title if it.job_description else None,
                scheduled_time=it.scheduled_time,
                status=it.status.value,
                notes=it.notes,
                created_at=it.created_at
            )
        )
    return results

@app.get("/api/health")
def health_check():
    return {"status": "ok", "phase": "Phase 1 - Foundation"}
