import os
import uuid
import json
import aiofiles
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import (
    FastAPI, Depends, HTTPException, status, UploadFile, File, Form,
    WebSocket, WebSocketDisconnect, Query
)
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import engine, get_db, SessionLocal
from app.models import (
    Base, User, CandidateProfile, Resume, JobDescription,
    ResumeJobMatch, Interview, InterviewQuestion, InterviewResult,
    InterviewAnalysisResult, Notification, UserRole, InterviewStatus
)
from app.auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, require_candidate, require_interviewer
)
from app.schemas import (
    UserRegisterRequest, UserLoginRequest, TokenResponse, UserResponse,
    CandidateProfileUpdate, CandidateProfileResponse, ResumeResponse,
    NotificationResponse, NotificationMarkReadRequest,
    JobDescriptionCreate, JobDescriptionResponse,
    InterviewCreate, InterviewResponse, MatchBreakdownResponse, CandidateMatchDetail,
    InterviewQuestionCreate, InterviewQuestionUpdate, InterviewQuestionResponse,
    InterviewSessionUpdateRequest, RecordingConsentRequest,
    InterviewAnalysisResponse, QuestionAnswerEvaluation, ResumeClaimVerification, FullTranscriptEntry
)
from app.ai.resume_parser import parse_resume_document
from app.ai.jd_analyzer import analyze_job_description
from app.ai.matcher import match_resume_to_jd
from app.ai.question_generator import generate_personalized_questions
from app.ai.analysis_service import run_complete_interview_analysis

# Initialize database schema
Base.metadata.create_all(bind=engine)

# Upload directory setup
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads", "resumes"))
RECORDINGS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads", "recordings"))
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(RECORDINGS_DIR, exist_ok=True)

app = FastAPI(
    title="AI Interview Platform",
    description="AI-powered interview platform with WebRTC live video rooms, profile sync, question management, and scheduling notifications.",
    version="4.0.0"
)

# ----------------- WEBRTC & ROOM SIGNALING MANAGER -----------------
class ConnectionManager:
    def __init__(self):
        # Map interview_id -> list of active WebSocket connections
        self.rooms: Dict[int, List[Dict[str, Any]]] = {}

    async def connect(self, interview_id: int, websocket: WebSocket, user_id: int, user_name: str, user_role: str):
        await websocket.accept()
        if interview_id not in self.rooms:
            self.rooms[interview_id] = []
        
        client_info = {
            "ws": websocket,
            "user_id": user_id,
            "user_name": user_name,
            "user_role": user_role
        }
        self.rooms[interview_id].append(client_info)

        # Notify existing peers in the room that a new peer joined
        for peer in self.rooms[interview_id]:
            if peer["ws"] != websocket:
                try:
                    await peer["ws"].send_json({
                        "type": "peer-joined",
                        "user_id": user_id,
                        "user_name": user_name,
                        "user_role": user_role
                    })
                except Exception:
                    pass

        # Send room state / list of other participants to the newly joined peer
        other_participants = [
            {"user_id": p["user_id"], "user_name": p["user_name"], "user_role": p["user_role"]}
            for p in self.rooms[interview_id] if p["ws"] != websocket
        ]
        await websocket.send_json({
            "type": "room-state",
            "participants": other_participants
        })

    def disconnect(self, interview_id: int, websocket: WebSocket):
        if interview_id in self.rooms:
            disconnected_user = None
            for p in self.rooms[interview_id]:
                if p["ws"] == websocket:
                    disconnected_user = p
                    break
            
            self.rooms[interview_id] = [p for p in self.rooms[interview_id] if p["ws"] != websocket]
            
            if not self.rooms[interview_id]:
                del self.rooms[interview_id]
            elif disconnected_user:
                # Notify remaining room participants
                for peer in self.rooms[interview_id]:
                    try:
                        import asyncio
                        asyncio.create_task(peer["ws"].send_json({
                            "type": "peer-left",
                            "user_id": disconnected_user["user_id"],
                            "user_name": disconnected_user["user_name"]
                        }))
                    except Exception:
                        pass

    async def broadcast_to_room(self, interview_id: int, message: dict, sender_ws: Optional[WebSocket] = None):
        if interview_id in self.rooms:
            for peer in self.rooms[interview_id]:
                if sender_ws is None or peer["ws"] != sender_ws:
                    try:
                        await peer["ws"].send_json(message)
                    except Exception:
                        pass

manager = ConnectionManager()


# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- EMAIL NOTIFICATION HELPER -----------------
def send_interview_email_notification(candidate_email: str, candidate_name: str, interview_title: str, job_role: str, scheduled_time: datetime, interviewer_name: str) -> bool:
    """
    Sends email notification if SMTP is configured.
    Falls back gracefully if SMTP settings are not provided in environment variables.
    """
    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = os.environ.get("SMTP_PORT")
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASSWORD")

    if not smtp_host or not smtp_user:
        # Email not configured - in-app notification handles delivery
        return False

    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = candidate_email
        msg['Subject'] = f"Interview Scheduled: {interview_title} ({job_role})"

        body = f"""Hello {candidate_name},

Your interview has been scheduled!

Interview: {interview_title}
Job Role: {job_role}
Interviewer: {interviewer_name}
Date & Time: {scheduled_time.strftime('%B %d, %Y at %I:%M %p UTC')}

Please log in to your candidate dashboard to review your preparation and details.

Best regards,
Hiring Team
"""
        msg.attach(MIMEText(body, 'plain'))

        with smtplib.SMTP(smtp_host, int(smtp_port or 587)) as server:
            server.starttls()
            if smtp_pass:
                server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"Email delivery notification notice: {e}")
        return False

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

            mock_edu = [{"degree": "Bachelor of Science in Computer Science", "raw_context": "B.S. Computer Science, University of California"}]
            mock_exp_details = [
                "Senior Software Engineer at Nexus Tech (2022 - Present) - FastAPI & Microservices",
                "Full Stack Developer at CloudWave (2020 - 2022) - Python, React, PostgreSQL"
            ]
            mock_projects = [
                {"title": "High-Throughput ML Inference Gateway", "description": "Built asynchronous FastAPI gateway handling 10k req/sec with Docker and Redis."},
                {"title": "Automated Candidate Evaluation Platform", "description": "Designed full-stack analytics pipeline in React and Python."}
            ]
            mock_certs = ["AWS Certified Solutions Architect - Associate"]

            # Create profile for candidate
            profile = CandidateProfile(
                user_id=candidate.id,
                phone="+1 (555) 349-8821",
                headline="Senior Full-Stack & Python Engineer",
                skills="Python, FastAPI, React, TypeScript, PostgreSQL, Docker, AWS, Scikit-Learn",
                experience_years=4.5,
                education=json.dumps(mock_edu),
                experience_details=json.dumps(mock_exp_details),
                projects=json.dumps(mock_projects),
                certifications=json.dumps(mock_certs)
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
                "name": "Alex Chen",
                "email": "candidate@platform.ai",
                "phone": "+1 (555) 349-8821",
                "headline": "Senior Full-Stack & Python Engineer",
                "skills": ["Python", "FastAPI", "React", "TypeScript", "PostgreSQL", "Docker", "AWS", "Git", "REST API", "SQL", "Scikit-Learn"],
                "technologies": ["FastAPI", "React", "PostgreSQL", "Docker", "AWS"],
                "education": mock_edu,
                "work_experience": {
                    "estimated_years": 4.5,
                    "roles_and_companies": mock_exp_details
                },
                "projects": mock_projects,
                "certifications": mock_certs,
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

            # Create initial notification for candidate
            notif = Notification(
                user_id=candidate.id,
                interview_id=interview1.id,
                title="Interview Scheduled: Technical Architecture Round",
                message=f"You have an upcoming interview for Senior AI Systems Engineer with {interviewer.full_name}.",
                job_role=interview1.job_role,
                scheduled_time=interview1.scheduled_time,
                interviewer_name=interviewer.full_name,
                is_read=0,
                email_sent=0
            )
            db.add(notif)
            db.commit()

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

def format_analysis_response(an: InterviewAnalysisResult) -> InterviewAnalysisResponse:
    q_evals = []
    if an.question_evaluations:
        try:
            raw_evals = json.loads(an.question_evaluations)
            q_evals = [QuestionAnswerEvaluation(**item) for item in raw_evals]
        except Exception as e:
            print("Error parsing question evaluations:", e)

    claims = []
    if an.resume_claims:
        try:
            raw_claims = json.loads(an.resume_claims)
            claims = [ResumeClaimVerification(**item) for item in raw_claims]
        except Exception as e:
            print("Error parsing resume claims:", e)

    transcript_list = []
    if an.full_transcript:
        try:
            raw_transcripts = json.loads(an.full_transcript)
            transcript_list = [FullTranscriptEntry(**item) for item in raw_transcripts]
        except Exception as e:
            print("Error parsing full transcript:", e)

    behaviour_data = None
    if an.behaviour_metrics_json:
        try:
            behaviour_data = json.loads(an.behaviour_metrics_json)
        except Exception as e:
            print("Error parsing behaviour metrics:", e)

    return InterviewAnalysisResponse(
        id=an.id,
        interview_id=an.interview_id,
        status=an.status or "completed",
        error_message=an.error_message,
        overall_relevance_score=an.overall_relevance_score or 0.0,
        overall_technical_score=an.overall_technical_score or 0.0,
        overall_completeness_score=an.overall_completeness_score or 0.0,
        average_score=an.average_score or 0.0,
        question_evaluations=q_evals,
        resume_claims=claims,
        full_transcript=transcript_list,
        behaviour_analysis=behaviour_data,
        created_at=an.created_at,
        updated_at=an.updated_at
    )

def format_interview_response(it: Interview, db: Session) -> InterviewResponse:
    match_data = None
    if it.candidate and it.candidate.candidate_profile and it.candidate.candidate_profile.resumes and it.job_description:
        latest_resume = sorted(it.candidate.candidate_profile.resumes, key=lambda r: r.uploaded_at, reverse=True)[0]
        match_obj = get_or_calculate_match(db, latest_resume, it.job_description)
        if match_obj:
            match_data = format_match_response(match_obj, it.job_description.title)

    questions_formatted = [format_question_response(q) for q in it.questions]

    # Parse session metadata if available
    session_meta = None
    if it.session_metadata:
        try:
            session_meta = json.loads(it.session_metadata)
        except Exception:
            session_meta = None

    analysis_data = None
    if it.analysis:
        analysis_data = format_analysis_response(it.analysis)

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
        start_time=it.start_time,
        end_time=it.end_time,
        current_question_index=it.current_question_index or 0,
        recording_path=f"/api/interviews/{it.id}/recording" if it.recording_path else None,
        recording_consent_candidate=it.recording_consent_candidate or 0,
        recording_consent_interviewer=it.recording_consent_interviewer or 0,
        session_metadata=session_meta,
        created_at=it.created_at,
        match_score=match_data,
        questions=questions_formatted,
        analysis=analysis_data
    )

def format_candidate_profile_response(profile: CandidateProfile, user: Optional[User] = None) -> CandidateProfileResponse:
    resumes_formatted = [format_resume_response(r) for r in profile.resumes]
    edu_list = json.loads(profile.education) if profile.education else []
    exp_list = json.loads(profile.experience_details) if profile.experience_details else []
    proj_list = json.loads(profile.projects) if profile.projects else []
    cert_list = json.loads(profile.certifications) if profile.certifications else []

    target_user = user or profile.user
    return CandidateProfileResponse(
        id=profile.id,
        user_id=profile.user_id,
        full_name=target_user.full_name if target_user else None,
        email=target_user.email if target_user else None,
        phone=profile.phone,
        headline=profile.headline,
        skills=profile.skills,
        experience_years=profile.experience_years or 0.0,
        education=edu_list,
        experience_details=exp_list,
        projects=proj_list,
        certifications=cert_list,
        resumes=resumes_formatted
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
    
    return format_candidate_profile_response(profile, current_user)

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

    # Allow updating full_name or email on the user record if provided
    user_updated = False
    if profile_data.full_name is not None and profile_data.full_name.strip():
        current_user.full_name = profile_data.full_name.strip()
        user_updated = True
    if profile_data.email is not None and profile_data.email.strip():
        new_email = profile_data.email.strip().lower()
        if new_email != current_user.email:
            existing = db.query(User).filter(User.email == new_email, User.id != current_user.id).first()
            if existing:
                raise HTTPException(status_code=400, detail="Email is already used by another account")
            current_user.email = new_email
            user_updated = True

    if profile_data.phone is not None:
        profile.phone = profile_data.phone
    if profile_data.headline is not None:
        profile.headline = profile_data.headline
    if profile_data.skills is not None:
        profile.skills = profile_data.skills
    if profile_data.experience_years is not None:
        profile.experience_years = profile_data.experience_years
    if profile_data.education is not None:
        profile.education = json.dumps(profile_data.education)
    if profile_data.experience_details is not None:
        profile.experience_details = json.dumps(profile_data.experience_details)
    if profile_data.projects is not None:
        profile.projects = json.dumps(profile_data.projects)
    if profile_data.certifications is not None:
        profile.certifications = json.dumps(profile_data.certifications)
    
    profile.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(profile)
    if user_updated:
        db.refresh(current_user)
    
    return format_candidate_profile_response(profile, current_user)

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
    extracted_data = parse_result.get("parsed_data", {})

    # Auto-populate profile fields with extracted information without overwriting existing manually set fields with empty/missing values
    # 1. Name & Email on User model
    if extracted_data.get("name") and (not current_user.full_name or current_user.full_name in ["Candidate", "Alex Chen"] or not current_user.full_name.strip()):
        current_user.full_name = extracted_data["name"]
    if extracted_data.get("email") and not current_user.email:
        current_user.email = extracted_data["email"].lower()

    # 2. Phone
    if extracted_data.get("phone") and (not profile.phone or not profile.phone.strip()):
        profile.phone = extracted_data["phone"]

    # 3. Headline
    if extracted_data.get("headline") and (not profile.headline or not profile.headline.strip()):
        profile.headline = extracted_data["headline"]

    # 4. Skills (populate or merge)
    extracted_skills = extracted_data.get("skills", [])
    if extracted_skills:
        if not profile.skills or not profile.skills.strip():
            profile.skills = ", ".join(extracted_skills)
        else:
            # Merge extracted skills with existing manually saved skills preserving both
            existing_skill_set = set([s.strip().lower() for s in profile.skills.split(",") if s.strip()])
            to_add = [s for s in extracted_skills if s.lower() not in existing_skill_set]
            if to_add:
                profile.skills = f"{profile.skills.strip()}, {', '.join(to_add)}"

    # 5. Experience Years
    extracted_years = extracted_data.get("work_experience", {}).get("estimated_years")
    if extracted_years and (profile.experience_years is None or profile.experience_years == 0):
        profile.experience_years = float(extracted_years)

    # 6. Education
    extracted_edu = extracted_data.get("education", [])
    if extracted_edu and (not profile.education or profile.education == "[]"):
        profile.education = json.dumps(extracted_edu)

    # 7. Experience Details / Roles
    extracted_roles = extracted_data.get("work_experience", {}).get("roles_and_companies", [])
    if extracted_roles and (not profile.experience_details or profile.experience_details == "[]"):
        profile.experience_details = json.dumps(extracted_roles)

    # 8. Projects
    extracted_projects = extracted_data.get("projects", [])
    if extracted_projects and (not profile.projects or profile.projects == "[]"):
        profile.projects = json.dumps(extracted_projects)

    # 9. Certifications
    extracted_certs = extracted_data.get("certifications", [])
    if extracted_certs and (not profile.certifications or profile.certifications == "[]"):
        profile.certifications = json.dumps(extracted_certs)

    profile.updated_at = datetime.utcnow()

    resume = Resume(
        candidate_profile_id=profile.id,
        original_filename=file.filename,
        stored_filename=unique_filename,
        file_path=file_path,
        file_size_bytes=file_size,
        file_type=file_ext,
        upload_status="Parsed",
        raw_text=parse_result["raw_text"],
        parsed_data=json.dumps(extracted_data),
        uploaded_at=datetime.utcnow()
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)
    db.refresh(profile)

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

# ----------------- NOTIFICATION ENDPOINTS -----------------

@app.get("/api/candidate/notifications", response_model=List[NotificationResponse])
def get_candidate_notifications(
    current_user: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    """Retrieves all notifications for the authenticated candidate ordered newest first"""
    notifs = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(desc(Notification.created_at))
        .all()
    )
    return [
        NotificationResponse(
            id=n.id,
            user_id=n.user_id,
            interview_id=n.interview_id,
            title=n.title,
            message=n.message,
            job_role=n.job_role,
            scheduled_time=n.scheduled_time,
            interviewer_name=n.interviewer_name,
            is_read=n.is_read,
            email_sent=n.email_sent,
            created_at=n.created_at
        )
        for n in notifs
    ]

@app.post("/api/candidate/notifications/read")
def mark_notifications_read(
    req: NotificationMarkReadRequest,
    current_user: User = Depends(require_candidate),
    db: Session = Depends(get_db)
):
    """Marks one or more notifications as read, or all if no IDs provided"""
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if req.notification_ids:
        query = query.filter(Notification.id.in_(req.notification_ids))
    
    updated_count = query.update({Notification.is_read: 1}, synchronize_session=False)
    db.commit()
    return {"status": "success", "updated": updated_count}

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

        edu_list = json.loads(profile.education) if (profile and profile.education) else None
        exp_list = json.loads(profile.experience_details) if (profile and profile.experience_details) else None
        proj_list = json.loads(profile.projects) if (profile and profile.projects) else None
        cert_list = json.loads(profile.certifications) if (profile and profile.certifications) else None

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
                education=edu_list,
                experience_details=exp_list,
                projects=proj_list,
                certifications=cert_list,
                latest_resume=format_resume_response(latest_resume) if latest_resume else None,
                match_score=match_resp
            )
        )
    return results

@app.get("/api/interviewer/candidates/{candidate_id}", response_model=CandidateProfileResponse)
def get_candidate_profile_detail(
    candidate_id: int,
    current_user: User = Depends(require_interviewer),
    db: Session = Depends(get_db)
):
    """Allows interviewer to view complete candidate profile including all structured sections"""
    candidate = db.query(User).filter(User.id == candidate_id, User.role == UserRole.CANDIDATE).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    profile = candidate.candidate_profile
    if not profile:
        profile = CandidateProfile(user_id=candidate.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)

    return format_candidate_profile_response(profile, candidate)

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

    # 1. Create In-App Notification for candidate
    formatted_date_time = new_interview.scheduled_time.strftime("%B %d, %Y at %I:%M %p")
    notif_msg = (
        f"You have an upcoming interview '{new_interview.title}' for {new_interview.job_role} "
        f"scheduled with {current_user.full_name} on {formatted_date_time}."
    )
    if new_interview.notes:
        notif_msg += f" Note: {new_interview.notes}"

    notification = Notification(
        user_id=candidate.id,
        interview_id=new_interview.id,
        title=f"Interview Scheduled: {new_interview.title}",
        message=notif_msg,
        job_role=new_interview.job_role,
        scheduled_time=new_interview.scheduled_time,
        interviewer_name=current_user.full_name,
        is_read=0,
        email_sent=0
    )

    # 2. Attempt optional Email Notification
    email_delivered = send_interview_email_notification(
        candidate_email=candidate.email,
        candidate_name=candidate.full_name,
        interview_title=new_interview.title,
        job_role=new_interview.job_role,
        scheduled_time=new_interview.scheduled_time,
        interviewer_name=current_user.full_name
    )
    if email_delivered:
        notification.email_sent = 1

    db.add(notification)
    db.commit()

    # 3. Phase 3: Auto-generate questions on creation
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

# ----------------- PHASE 4: WEBSOCKET SIGNALING & INTERVIEW ROOM -----------------

@app.websocket("/api/ws/interview/{interview_id}")
async def websocket_interview_signaling(
    websocket: WebSocket,
    interview_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for peer-to-peer WebRTC signaling (offers, answers, ICE candidates),
    live question synchronization, recording consent alerts, and room management.
    """
    # Authenticate via query param token or authorization
    user = None
    if token:
        try:
            from jose import jwt
            from app.auth import SECRET_KEY, ALGORITHM
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_identifier = payload.get("sub")
            if user_identifier:
                # sub is email in create_access_token
                user = db.query(User).filter((User.email == user_identifier) | (User.id == str(user_identifier))).first()
        except Exception as e:
            print("WS auth exception:", e)
            user = None

    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not interview or (user.id != interview.interviewer_id and user.id != interview.candidate_id):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_name = user.full_name or user.email
    user_role = user.role.value

    await manager.connect(interview_id, websocket, user.id, user_name, user_role)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            # Route WebRTC signaling and room messages
            if msg_type in ["offer", "answer", "ice-candidate"]:
                # Relay WebRTC signaling packets to the peer(s)
                await manager.broadcast_to_room(interview_id, {
                    "type": msg_type,
                    "sender_id": user.id,
                    "sender_role": user_role,
                    "data": data.get("data")
                }, sender_ws=websocket)

            elif msg_type == "question-nav":
                # Interviewer navigating questions
                q_idx = data.get("question_index", 0)
                interview.current_question_index = q_idx
                db.commit()
                await manager.broadcast_to_room(interview_id, {
                    "type": "question-nav",
                    "question_index": q_idx,
                    "sender_id": user.id
                }, sender_ws=websocket)

            elif msg_type == "recording-consent":
                # Broadcast consent status
                consent_given = data.get("consent", False)
                if user.role == UserRole.CANDIDATE:
                    interview.recording_consent_candidate = 1 if consent_given else 0
                else:
                    interview.recording_consent_interviewer = 1 if consent_given else 0
                db.commit()

                await manager.broadcast_to_room(interview_id, {
                    "type": "recording-consent",
                    "user_id": user.id,
                    "user_role": user_role,
                    "consent": consent_given
                })

            elif msg_type == "session-status":
                # Session status updates (e.g., started, ended)
                new_status = data.get("status")
                await manager.broadcast_to_room(interview_id, {
                    "type": "session-status",
                    "status": new_status,
                    "sender_id": user.id
                })

            elif msg_type == "chat-message":
                # In-room text chat / notes
                await manager.broadcast_to_room(interview_id, {
                    "type": "chat-message",
                    "sender_id": user.id,
                    "sender_name": user_name,
                    "sender_role": user_role,
                    "text": data.get("text"),
                    "timestamp": datetime.utcnow().isoformat()
                })

            elif msg_type == "media-state":
                # Mic / Camera mute status changes
                await manager.broadcast_to_room(interview_id, {
                    "type": "media-state",
                    "sender_id": user.id,
                    "audio_enabled": data.get("audio_enabled", True),
                    "video_enabled": data.get("video_enabled", True)
                }, sender_ws=websocket)

    except WebSocketDisconnect:
        manager.disconnect(interview_id, websocket)
    except Exception as e:
        print(f"WebSocket error in room {interview_id}: {e}")
        manager.disconnect(interview_id, websocket)


# ----------------- PHASE 4: SESSION & RECORDING REST ENDPOINTS -----------------

@app.put("/api/interviews/{interview_id}/session", response_model=InterviewResponse)
def update_interview_session(
    interview_id: int,
    session_data: InterviewSessionUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates live session state: start_time, end_time, current_question_index, status, and session_metadata.
    """
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    if current_user.id != interview.interviewer_id and current_user.id != interview.candidate_id:
        raise HTTPException(status_code=403, detail="Unauthorized for this interview")

    if session_data.status is not None:
        status_str = session_data.status.lower()
        if status_str in ["scheduled", "in_progress", "completed", "cancelled"]:
            interview.status = InterviewStatus(status_str)
        else:
            interview.status = InterviewStatus.SCHEDULED

    if session_data.start_time is not None:
        interview.start_time = session_data.start_time
    elif session_data.status and session_data.status.lower() == "in_progress" and not interview.start_time:
        interview.start_time = datetime.utcnow()

    if session_data.end_time is not None:
        interview.end_time = session_data.end_time
    elif session_data.status and session_data.status.lower() in ["completed", "completed"] and not interview.end_time:
        interview.end_time = datetime.utcnow()

    if session_data.current_question_index is not None:
        interview.current_question_index = session_data.current_question_index

    if session_data.session_metadata is not None:
        existing_meta = json.loads(interview.session_metadata) if interview.session_metadata else {}
        existing_meta.update(session_data.session_metadata)
        interview.session_metadata = json.dumps(existing_meta)

    db.commit()
    db.refresh(interview)
    return format_interview_response(interview, db)


@app.post("/api/interviews/{interview_id}/recording/consent", response_model=InterviewResponse)
def record_interview_consent(
    interview_id: int,
    consent_req: RecordingConsentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Records explicit audio/video recording consent for candidate or interviewer"""
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    if current_user.id == interview.candidate_id:
        interview.recording_consent_candidate = 1 if consent_req.consent else 0
    elif current_user.id == interview.interviewer_id:
        interview.recording_consent_interviewer = 1 if consent_req.consent else 0
    else:
        raise HTTPException(status_code=403, detail="Unauthorized")

    db.commit()
    db.refresh(interview)
    return format_interview_response(interview, db)


@app.post("/api/interviews/{interview_id}/recording", response_model=InterviewResponse)
async def upload_interview_recording(
    interview_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Securely uploads and saves interview session video recording.
    Restricted to interview participants.
    """
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    if current_user.id != interview.candidate_id and current_user.id != interview.interviewer_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    # Generate secure filename
    ext = os.path.splitext(file.filename)[1] if file.filename else ".webm"
    if not ext or ext == "":
        ext = ".webm"
    filename = f"interview_{interview.id}_{uuid.uuid4().hex[:10]}{ext}"
    dest_path = os.path.join(RECORDINGS_DIR, filename)

    async with aiofiles.open(dest_path, "wb") as out_file:
        content = await file.read()
        await out_file.write(content)

    interview.recording_path = dest_path
    
    # Store recording info in metadata
    meta = json.loads(interview.session_metadata) if interview.session_metadata else {}
    meta["recording_filename"] = filename
    meta["recording_size_bytes"] = len(content)
    meta["recording_uploaded_at"] = datetime.utcnow().isoformat()
    meta["recording_uploader_id"] = current_user.id
    interview.session_metadata = json.dumps(meta)

    db.commit()
    db.refresh(interview)
    return format_interview_response(interview, db)


@app.get("/api/interviews/{interview_id}/recording")
def download_interview_recording(
    interview_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Streams or downloads recorded interview session.
    Protected to authorized interview participants.
    """
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    if current_user.id != interview.candidate_id and current_user.id != interview.interviewer_id:
        raise HTTPException(status_code=403, detail="Unauthorized access to interview recording")

    if not interview.recording_path or not os.path.exists(interview.recording_path):
        raise HTTPException(status_code=404, detail="No recording found for this interview")

    return FileResponse(
        interview.recording_path,
        media_type="video/webm",
        filename=f"interview_{interview.id}_recording.webm"
    )


# ----------------- PHASE 5: AI INTERVIEW ANALYSIS & TRANSCRIPTION ENDPOINTS -----------------

@app.post("/api/interviews/{interview_id}/analysis", response_model=InterviewAnalysisResponse)
def trigger_interview_analysis(
    interview_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Triggers or retries Phase 5 AI Interview Analysis:
    1. Speech-to-text transcript generation with timestamps
    2. Question-by-question answer evaluation (relevance, technical accuracy, completeness)
    3. Resume claim verification (consistent, potential inconsistency, unsupported)
    """
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Only participants can trigger/view analysis
    if current_user.id != interview.candidate_id and current_user.id != interview.interviewer_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    # Fetch parsed candidate resume & parsed JD
    resume_parsed = None
    resume_raw = ""
    cand_profile_dict = {}
    if interview.candidate and interview.candidate.candidate_profile:
        profile = interview.candidate.candidate_profile
        cand_profile_dict = {
            "full_name": interview.candidate.full_name,
            "skills": profile.skills,
            "experience_years": profile.experience_years,
            "education": json.loads(profile.education) if profile.education else [],
            "experience_details": json.loads(profile.experience_details) if profile.experience_details else [],
            "projects": json.loads(profile.projects) if profile.projects else [],
            "certifications": json.loads(profile.certifications) if profile.certifications else []
        }
        if profile.resumes:
            latest_r = sorted(profile.resumes, key=lambda r: r.uploaded_at, reverse=True)[0]
            if latest_r.parsed_data:
                resume_parsed = json.loads(latest_r.parsed_data)
            resume_raw = latest_r.raw_text or ""

    jd_parsed = None
    if interview.job_description and interview.job_description.parsed_data:
        jd_parsed = json.loads(interview.job_description.parsed_data)

    # Format question objects for analysis
    question_payload = [
        {
            "id": q.id,
            "question_text": q.question_text,
            "category": q.category,
            "difficulty": q.difficulty,
            "order_index": q.order_index
        }
        for q in interview.questions
    ]

    try:
        # Run reusable AI Analysis Engine
        analysis_data = run_complete_interview_analysis(
            interview_id=interview.id,
            recording_path=interview.recording_path,
            questions=question_payload,
            candidate_profile=cand_profile_dict,
            jd_parsed=jd_parsed,
            resume_parsed=resume_parsed,
            resume_raw_text=resume_raw,
            job_role=interview.job_role,
            interviewer_name=interview.interviewer.full_name if interview.interviewer else "Interviewer",
            candidate_name=interview.candidate.full_name if interview.candidate else "Candidate"
        )

        # Check existing analysis record or create new
        analysis_record = db.query(InterviewAnalysisResult).filter(InterviewAnalysisResult.interview_id == interview.id).first()
        if not analysis_record:
            analysis_record = InterviewAnalysisResult(
                interview_id=interview.id,
                status="completed",
                overall_relevance_score=analysis_data["overall_relevance_score"],
                overall_technical_score=analysis_data["overall_technical_score"],
                overall_completeness_score=analysis_data["overall_completeness_score"],
                average_score=analysis_data["average_score"],
                question_evaluations=json.dumps(analysis_data["question_evaluations"]),
                resume_claims=json.dumps(analysis_data["resume_claims"]),
                full_transcript=json.dumps(analysis_data["full_transcript"]),
                behaviour_metrics_json=json.dumps(analysis_data.get("behaviour_analysis", {}))
            )
            db.add(analysis_record)
        else:
            analysis_record.status = "completed"
            analysis_record.error_message = None
            analysis_record.overall_relevance_score = analysis_data["overall_relevance_score"]
            analysis_record.overall_technical_score = analysis_data["overall_technical_score"]
            analysis_record.overall_completeness_score = analysis_data["overall_completeness_score"]
            analysis_record.average_score = analysis_data["average_score"]
            analysis_record.question_evaluations = json.dumps(analysis_data["question_evaluations"])
            analysis_record.resume_claims = json.dumps(analysis_data["resume_claims"])
            analysis_record.full_transcript = json.dumps(analysis_data["full_transcript"])
            analysis_record.behaviour_metrics_json = json.dumps(analysis_data.get("behaviour_analysis", {}))
            analysis_record.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(analysis_record)
        return format_analysis_response(analysis_record)

    except Exception as e:
        db.rollback()
        # Save failure state to allow retry
        analysis_record = db.query(InterviewAnalysisResult).filter(InterviewAnalysisResult.interview_id == interview.id).first()
        if not analysis_record:
            analysis_record = InterviewAnalysisResult(
                interview_id=interview.id,
                status="failed",
                error_message=str(e),
                overall_relevance_score=0.0,
                overall_technical_score=0.0,
                overall_completeness_score=0.0,
                average_score=0.0,
                question_evaluations="[]",
                resume_claims="[]",
                full_transcript="[]"
            )
            db.add(analysis_record)
        else:
            analysis_record.status = "failed"
            analysis_record.error_message = str(e)
            analysis_record.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(analysis_record)
        return format_analysis_response(analysis_record)


@app.get("/api/interviews/{interview_id}/analysis", response_model=InterviewAnalysisResponse)
def get_interview_analysis(
    interview_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetches completed analysis for an interview or automatically generates it if interview is completed.
    """
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    if current_user.id != interview.candidate_id and current_user.id != interview.interviewer_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    analysis_record = db.query(InterviewAnalysisResult).filter(InterviewAnalysisResult.interview_id == interview.id).first()
    if not analysis_record:
        # Generate automatically
        return trigger_interview_analysis(interview_id, current_user=current_user, db=db)

    return format_analysis_response(analysis_record)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "platform": "AI Interview Platform with Phase 5 Speech-to-Text & AI Analysis Engine"}


