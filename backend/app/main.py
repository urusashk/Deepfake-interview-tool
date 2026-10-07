import os
import uuid
import json
import aiofiles
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import engine, get_db, SessionLocal
from app.models import (
    Base, User, CandidateProfile, Resume, JobDescription,
    ResumeJobMatch, Interview, InterviewQuestion, InterviewResult,
    UserRole, InterviewStatus
)
from app.auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, require_candidate, require_interviewer
)
from app.schemas import (
    UserRegisterRequest, UserLoginRequest, TokenResponse, UserResponse,
    CandidateProfileUpdate, CandidateProfileResponse, ResumeResponse,
    JobDescriptionCreate, JobDescriptionResponse,
    InterviewCreate, InterviewResponse, MatchBreakdownResponse, CandidateMatchDetail,
    InterviewQuestionCreate, InterviewQuestionUpdate, InterviewQuestionResponse
)
from app.ai.resume_parser import parse_resume_document
from app.ai.jd_analyzer import analyze_job_description
from app.ai.matcher import match_resume_to_jd
from app.ai.question_generator import generate_personalized_questions

# Initialize database schema
Base.metadata.create_all(bind=engine)

# Upload directory setup
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads", "resumes"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(
    title="AI Interview Platform - Phase 3",
    description="AI-powered personalized interview question generation, question management, resume parsing, and resume-JD matching.",
    version="3.0.0"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- SEED DATA HELPER (PHASE 3 READY) -----------------
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
                skills="Python, FastAPI, React, TypeScript, PostgreSQL, Docker, AWS, Scikit-Learn",
                experience_years=4.5
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)

            # Create sample Job Description with structured parsed_data
            jd_text = "We are seeking a talented Senior AI Systems Engineer to build robust pipelines, REST APIs, and microservices for our core platform."
            jd_reqs = "Requirements: 4+ years Python, FastAPI/Django, PostgreSQL, Docker, AWS, REST API design, Machine Learning concepts. Preferred: TypeScript, Redis."
            jd_parsed = analyze_job_description("Senior AI Systems Engineer", jd_text, jd_reqs)

            jd = JobDescription(
                title="Senior AI Systems Engineer",
                role_category="Software Engineering",
                description_text=jd_text,
                requirements=jd_reqs,
                parsed_data=json.dumps(jd_parsed),
                created_by=interviewer.id
            )
            db.add(jd)
            db.commit()
            db.refresh(jd)

            # Create sample mock resume
            resume_parsed_mock = {
                "skills": ["Python", "FastAPI", "React", "TypeScript", "PostgreSQL", "Docker", "AWS", "Git", "REST API", "SQL", "Scikit-Learn"],
                "technologies": ["FastAPI", "React", "PostgreSQL", "Docker", "AWS"],
                "education": [{"degree": "Bachelor of Science in Computer Science", "raw_context": "B.S. Computer Science, University of California"}],
                "work_experience": {
                    "estimated_years": 4.5,
                    "roles_and_companies": [
                        "Senior Software Engineer at Nexus Tech (2022 - Present) - FastAPI & Microservices",
                        "Full Stack Developer at CloudWave (2020 - 2022) - Python, React, PostgreSQL"
                    ]
                },
                "projects": [
                    {"title": "High-Throughput ML Inference Gateway", "description": "Built asynchronous FastAPI gateway handling 10k req/sec with Docker and Redis."},
                    {"title": "Automated Candidate Evaluation Platform", "description": "Designed full-stack analytics pipeline in React and Python."}
                ],
                "certifications": ["AWS Certified Solutions Architect - Associate"],
                "summary": "Experienced Python and Cloud Systems Engineer with 4.5+ years building scalable microservices and APIs."
            }

            dummy_resume_path = os.path.join(UPLOAD_DIR, "demo_alex_chen_resume.pdf")
            with open(dummy_resume_path, "w", encoding="utf-8") as f:
                f.write("Demo Resume: Alex Chen - Senior Full-Stack & Python Engineer\nSkills: Python, FastAPI, React, TypeScript, PostgreSQL, Docker, AWS, Scikit-Learn\nExperience: 4.5 Years\nEducation: B.S. in Computer Science\n")

            resume = Resume(
                candidate_profile_id=profile.id,
                original_filename="alex_chen_resume.pdf",
                stored_filename="demo_alex_chen_resume.pdf",
                file_path=dummy_resume_path,
                file_size_bytes=45200,
                file_type="pdf",
                upload_status="Parsed",
                raw_text="Demo Resume: Alex Chen - Senior Full-Stack & Python Engineer\nSkills: Python, FastAPI, React, TypeScript, PostgreSQL, Docker, AWS, Scikit-Learn\nExperience: 4.5 Years\nEducation: B.S. in Computer Science\n",
                parsed_data=json.dumps(resume_parsed_mock)
            )
            db.add(resume)
            db.commit()
            db.refresh(resume)

            # Compute initial semantic match
            match_data = match_resume_to_jd(resume_parsed_mock, jd_parsed, resume.raw_text, f"{jd.description_text} {jd.requirements}")
            resume_match = ResumeJobMatch(
                resume_id=resume.id,
                job_description_id=jd.id,
                overall_match_score=match_data["overall_match_score"],
                skills_match_score=match_data["skills_match_score"],
                experience_match_score=match_data["experience_match_score"],
                education_match_score=match_data["education_match_score"],
                projects_match_score=match_data["projects_match_score"],
                matching_skills=json.dumps(match_data["matching_skills"]),
                missing_skills=json.dumps(match_data["missing_skills"]),
                ai_summary=match_data["ai_summary"]
            )
            db.add(resume_match)

            # Create sample interview linked to JD
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
            db.refresh(interview1)

            # Auto-generate Phase 3 Questions for the demo interview
            generated_qs = generate_personalized_questions(
                resume_parsed=resume_parsed_mock,
                jd_parsed=jd_parsed,
                job_role=interview1.job_role,
                target_count=7
            )
            for q in generated_qs:
                new_q = InterviewQuestion(
                    interview_id=interview1.id,
                    question_text=q["question_text"],
                    category=q["category"],
                    difficulty=q["difficulty"],
                    order_index=q["order_index"],
                    is_custom=q.get("is_custom", 0)
                )
                db.add(new_q)
            db.commit()
    finally:
        db.close()

init_seed_data()

# ----------------- HELPER: COMPUTE OR GET RESUME-JD MATCH -----------------

def get_or_calculate_match(db: Session, resume: Resume, jd: JobDescription) -> Optional[ResumeJobMatch]:
    if not resume or not jd:
        return None
    
    match_record = db.query(ResumeJobMatch).filter(
        ResumeJobMatch.resume_id == resume.id,
        ResumeJobMatch.job_description_id == jd.id
    ).first()

    if match_record:
        return match_record

    resume_parsed = json.loads(resume.parsed_data) if resume.parsed_data else None
    if not resume_parsed:
        parse_res = parse_resume_document(resume.file_path, resume.file_type)
        resume.raw_text = parse_res["raw_text"]
        resume.parsed_data = json.dumps(parse_res["parsed_data"])
        resume.upload_status = "Parsed"
        db.commit()
        db.refresh(resume)
        resume_parsed = parse_res["parsed_data"]

    jd_parsed = json.loads(jd.parsed_data) if jd.parsed_data else None
    if not jd_parsed:
        jd_parsed = analyze_job_description(jd.title, jd.description_text, jd.requirements or "")
        jd.parsed_data = json.dumps(jd_parsed)
        db.commit()
        db.refresh(jd)

    match_result = match_resume_to_jd(
        resume_parsed,
        jd_parsed,
        resume.raw_text or "",
        f"{jd.description_text} {jd.requirements or ''}"
    )

    new_match = ResumeJobMatch(
        resume_id=resume.id,
        job_description_id=jd.id,
        overall_match_score=match_result["overall_match_score"],
        skills_match_score=match_result["skills_match_score"],
        experience_match_score=match_result["experience_match_score"],
        education_match_score=match_result["education_match_score"],
        projects_match_score=match_result["projects_match_score"],
        matching_skills=json.dumps(match_result["matching_skills"]),
        missing_skills=json.dumps(match_result["missing_skills"]),
        ai_summary=match_result["ai_summary"]
    )
    db.add(new_match)
    db.commit()
    db.refresh(new_match)
    return new_match

def format_match_response(match: ResumeJobMatch, jd_title: Optional[str] = None) -> MatchBreakdownResponse:
    return MatchBreakdownResponse(
        id=match.id,
        overall_match_score=match.overall_match_score,
        skills_match_score=match.skills_match_score,
        experience_match_score=match.experience_match_score,
        education_match_score=match.education_match_score,
        projects_match_score=match.projects_match_score,
        matching_skills=json.loads(match.matching_skills) if match.matching_skills else [],
        missing_skills=json.loads(match.missing_skills) if match.missing_skills else [],
        ai_summary=match.ai_summary,
        job_description_title=jd_title
    )

def format_resume_response(r: Resume) -> ResumeResponse:
    parsed_json = json.loads(r.parsed_data) if r.parsed_data else None
    return ResumeResponse(
        id=r.id,
        original_filename=r.original_filename,
        file_size_bytes=r.file_size_bytes,
        file_type=r.file_type,
        upload_status=r.upload_status,
        parsed_data=parsed_json,
        uploaded_at=r.uploaded_at
    )

def format_question_response(q: InterviewQuestion) -> InterviewQuestionResponse:
    return InterviewQuestionResponse(
        id=q.id,
        interview_id=q.interview_id,
        question_text=q.question_text,
        category=q.category or "Technical",
        difficulty=q.difficulty or "Medium",
        order_index=q.order_index or 0,
        is_custom=q.is_custom or 0,
        created_at=q.created_at,
        updated_at=q.updated_at
    )

def format_interview_response(it: Interview, db: Session) -> InterviewResponse:
    match_data = None
    if it.candidate and it.candidate.candidate_profile and it.candidate.candidate_profile.resumes and it.job_description:
        latest_resume = sorted(it.candidate.candidate_profile.resumes, key=lambda r: r.uploaded_at, reverse=True)[0]
        match_obj = get_or_calculate_match(db, latest_resume, it.job_description)
        if match_obj:
            match_data = format_match_response(match_obj, it.job_description.title)

    questions_formatted = [format_question_response(q) for q in it.questions]

    return InterviewResponse(
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
        created_at=it.created_at,
        match_score=match_data,
        questions=questions_formatted
    )

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
    
    resumes_formatted = [format_resume_response(r) for r in profile.resumes]
    return CandidateProfileResponse(
        id=profile.id,
        user_id=profile.user_id,
        phone=profile.phone,
        headline=profile.headline,
        skills=profile.skills,
        experience_years=profile.experience_years,
        resumes=resumes_formatted
    )

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
    
    resumes_formatted = [format_resume_response(r) for r in profile.resumes]
    return CandidateProfileResponse(
        id=profile.id,
        user_id=profile.user_id,
        phone=profile.phone,
        headline=profile.headline,
        skills=profile.skills,
        experience_years=profile.experience_years,
        resumes=resumes_formatted
    )

@app.post("/api/candidate/resume/upload", response_model=ResumeResponse)
async def upload_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
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

    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    file_size = 0
    async with aiofiles.open(file_path, "wb") as out_file:
        while content := await file.read(1024 * 1024):
            file_size += len(content)
            await out_file.write(content)

    parse_result = parse_resume_document(file_path, file_ext, profile.headline or "")
    
    if not profile.skills and parse_result["parsed_data"].get("skills"):
        profile.skills = ", ".join(parse_result["parsed_data"]["skills"])
    if profile.experience_years == 0 and parse_result["parsed_data"].get("work_experience", {}).get("estimated_years"):
        profile.experience_years = parse_result["parsed_data"]["work_experience"]["estimated_years"]

    resume = Resume(
        candidate_profile_id=profile.id,
        original_filename=file.filename,
        stored_filename=unique_filename,
        file_path=file_path,
        file_size_bytes=file_size,
        file_type=file_ext,
        upload_status="Parsed",
        raw_text=parse_result["raw_text"],
        parsed_data=json.dumps(parse_result["parsed_data"]),
        uploaded_at=datetime.utcnow()
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)

    all_jds = db.query(JobDescription).all()
    for jd in all_jds:
        get_or_calculate_match(db, resume, jd)

    return format_resume_response(resume)

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
    return [format_interview_response(it, db) for it in interviews]

# ----------------- INTERVIEWER ENDPOINTS -----------------

@app.get("/api/interviewer/candidates", response_model=List[CandidateMatchDetail])
def get_all_candidates_with_matches(
    job_description_id: Optional[int] = None,
    current_user: User = Depends(require_interviewer),
    db: Session = Depends(get_db)
):
    candidates = db.query(User).filter(User.role == UserRole.CANDIDATE).all()
    
    target_jd = None
    if job_description_id:
        target_jd = db.query(JobDescription).filter(JobDescription.id == job_description_id).first()
    if not target_jd:
        target_jd = db.query(JobDescription).order_by(desc(JobDescription.created_at)).first()

    results = []
    for cand in candidates:
        profile = cand.candidate_profile
        latest_resume = None
        match_resp = None

        if profile and profile.resumes:
            latest_resume = sorted(profile.resumes, key=lambda r: r.uploaded_at, reverse=True)[0]
            if target_jd and latest_resume:
                match_obj = get_or_calculate_match(db, latest_resume, target_jd)
                if match_obj:
                    match_resp = format_match_response(match_obj, target_jd.title)

        results.append(
            CandidateMatchDetail(
                id=cand.id,
                full_name=cand.full_name,
                email=cand.email,
                created_at=cand.created_at,
                phone=profile.phone if profile else None,
                headline=profile.headline if profile else None,
                skills=profile.skills if profile else None,
                experience_years=profile.experience_years if profile else 0.0,
                latest_resume=format_resume_response(latest_resume) if latest_resume else None,
                match_score=match_resp
            )
        )
    return results

@app.get("/api/interviewer/job-descriptions", response_model=List[JobDescriptionResponse])
def get_job_descriptions(
    current_user: User = Depends(require_interviewer),
    db: Session = Depends(get_db)
):
    jds = db.query(JobDescription).order_by(desc(JobDescription.created_at)).all()
    return [
        JobDescriptionResponse(
            id=j.id,
            title=j.title,
            role_category=j.role_category,
            description_text=j.description_text,
            requirements=j.requirements,
            parsed_data=json.loads(j.parsed_data) if j.parsed_data else None,
            created_by=j.created_by,
            created_at=j.created_at
        )
        for j in jds
    ]

@app.post("/api/interviewer/job-descriptions", response_model=JobDescriptionResponse)
def create_job_description(
    jd_in: JobDescriptionCreate,
    current_user: User = Depends(require_interviewer),
    db: Session = Depends(get_db)
):
    parsed_info = analyze_job_description(jd_in.title, jd_in.description_text, jd_in.requirements or "")

    new_jd = JobDescription(
        title=jd_in.title,
        role_category=jd_in.role_category,
        description_text=jd_in.description_text,
        requirements=jd_in.requirements,
        parsed_data=json.dumps(parsed_info),
        created_by=current_user.id
    )
    db.add(new_jd)
    db.commit()
    db.refresh(new_jd)

    all_resumes = db.query(Resume).all()
    for resume in all_resumes:
        get_or_calculate_match(db, resume, new_jd)

    return JobDescriptionResponse(
        id=new_jd.id,
        title=new_jd.title,
        role_category=new_jd.role_category,
        description_text=new_jd.description_text,
        requirements=new_jd.requirements,
        parsed_data=parsed_info,
        created_by=new_jd.created_by,
        created_at=new_jd.created_at
    )

@app.post("/api/interviewer/interviews", response_model=InterviewResponse)
def create_interview(
    interview_in: InterviewCreate,
    current_user: User = Depends(require_interviewer),
    db: Session = Depends(get_db)
):
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

    # Phase 3: Auto-generate questions on creation
    cand_resume_parsed = None
    if candidate.candidate_profile and candidate.candidate_profile.resumes:
        latest_r = sorted(candidate.candidate_profile.resumes, key=lambda r: r.uploaded_at, reverse=True)[0]
        if latest_r.parsed_data:
            cand_resume_parsed = json.loads(latest_r.parsed_data)

    jd_parsed = None
    if new_interview.job_description and new_interview.job_description.parsed_data:
        jd_parsed = json.loads(new_interview.job_description.parsed_data)

    generated_qs = generate_personalized_questions(
        resume_parsed=cand_resume_parsed,
        jd_parsed=jd_parsed,
        job_role=new_interview.job_role,
        target_count=7
    )

    for q in generated_qs:
        new_q = InterviewQuestion(
            interview_id=new_interview.id,
            question_text=q["question_text"],
            category=q["category"],
            difficulty=q["difficulty"],
            order_index=q["order_index"],
            is_custom=0
        )
        db.add(new_q)
    db.commit()
    db.refresh(new_interview)

    return format_interview_response(new_interview, db)

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
    return [format_interview_response(it, db) for it in interviews]

@app.get("/api/interviews/{interview_id}", response_model=InterviewResponse)
def get_interview_detail(
    interview_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    # Check access permission
    if current_user.role == UserRole.CANDIDATE and interview.candidate_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access forbidden")
    if current_user.role == UserRole.INTERVIEWER and interview.interviewer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access forbidden")

    return format_interview_response(interview, db)

# ----------------- PHASE 3: QUESTION MANAGEMENT ENDPOINTS -----------------

@app.post("/api/interviews/{interview_id}/questions/generate", response_model=List[InterviewQuestionResponse])
def regenerate_interview_questions(
    interview_id: int,
    current_user: User = Depends(require_interviewer),
    db: Session = Depends(get_db)
):
    """Regenerates AI questions for the interview upon explicit request"""
    interview = db.query(Interview).filter(Interview.id == interview_id, Interview.interviewer_id == current_user.id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Wipe existing AI questions (keep custom or wipe all)
    db.query(InterviewQuestion).filter(InterviewQuestion.interview_id == interview.id).delete()
    db.commit()

    cand_resume_parsed = None
    if interview.candidate and interview.candidate.candidate_profile and interview.candidate.candidate_profile.resumes:
        latest_r = sorted(interview.candidate.candidate_profile.resumes, key=lambda r: r.uploaded_at, reverse=True)[0]
        if latest_r.parsed_data:
            cand_resume_parsed = json.loads(latest_r.parsed_data)

    jd_parsed = None
    if interview.job_description and interview.job_description.parsed_data:
        jd_parsed = json.loads(interview.job_description.parsed_data)

    new_qs = generate_personalized_questions(
        resume_parsed=cand_resume_parsed,
        jd_parsed=jd_parsed,
        job_role=interview.job_role,
        target_count=7
    )

    created_questions = []
    for q in new_qs:
        q_obj = InterviewQuestion(
            interview_id=interview.id,
            question_text=q["question_text"],
            category=q["category"],
            difficulty=q["difficulty"],
            order_index=q["order_index"],
            is_custom=0
        )
        db.add(q_obj)
        db.commit()
        db.refresh(q_obj)
        created_questions.append(format_question_response(q_obj))

    return created_questions

@app.post("/api/interviews/{interview_id}/questions", response_model=InterviewQuestionResponse)
def add_custom_question(
    interview_id: int,
    question_in: InterviewQuestionCreate,
    current_user: User = Depends(require_interviewer),
    db: Session = Depends(get_db)
):
    interview = db.query(Interview).filter(Interview.id == interview_id, Interview.interviewer_id == current_user.id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    max_order = len(interview.questions)
    new_q = InterviewQuestion(
        interview_id=interview.id,
        question_text=question_in.question_text,
        category=question_in.category or "Technical",
        difficulty=question_in.difficulty or "Medium",
        order_index=max_order + 1,
        is_custom=1
    )
    db.add(new_q)
    db.commit()
    db.refresh(new_q)
    return format_question_response(new_q)

@app.put("/api/interviews/questions/{question_id}", response_model=InterviewQuestionResponse)
def update_question(
    question_id: int,
    question_update: InterviewQuestionUpdate,
    current_user: User = Depends(require_interviewer),
    db: Session = Depends(get_db)
):
    q = db.query(InterviewQuestion).filter(InterviewQuestion.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    
    if q.interview.interviewer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    if question_update.question_text is not None:
        q.question_text = question_update.question_text
    if question_update.category is not None:
        q.category = question_update.category
    if question_update.difficulty is not None:
        q.difficulty = question_update.difficulty
    if question_update.order_index is not None:
        q.order_index = question_update.order_index

    q.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(q)
    return format_question_response(q)

@app.delete("/api/interviews/questions/{question_id}")
def delete_question(
    question_id: int,
    current_user: User = Depends(require_interviewer),
    db: Session = Depends(get_db)
):
    q = db.query(InterviewQuestion).filter(InterviewQuestion.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    
    if q.interview.interviewer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    db.delete(q)
    db.commit()
    return {"status": "success", "message": "Question deleted successfully"}

@app.get("/api/health")
def health_check():
    return {"status": "ok", "phase": "Phase 3 - AI Question Generation & Management"}
