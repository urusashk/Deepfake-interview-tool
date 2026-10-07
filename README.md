# AI Interview Platform — Phase 1 Foundation

A clean, modern, and minimal foundation for an AI-powered interview platform built with **FastAPI**, **SQLite/SQLAlchemy**, and **React (Vite)**.

---

## 🏗 System Architecture & Database Schema

The database models in [models.py](file:///c:/Users/URUSA%20SHAIKH/ai%20project/Deepfake-interview-tool/backend/app/models.py) are designed to support Phase 1 operations while laying the schema ground for upcoming AI evaluation phases:

1. **`users`**: Email, password hash (bcrypt), full name, and role (`candidate` | `interviewer`).
2. **`candidate_profiles`**: Linked to User with phone, professional headline, skills, experience years.
3. **`resumes`**: File storage metadata, original filename, unique stored filename, file size, file type (PDF/DOCX), and status (`Uploaded`).
4. **`job_descriptions`**: Title, role category, description overview, requirements, author reference.
5. **`interviews`**: Title, job role, interviewer ID, candidate ID, job description ID, scheduled timestamp, status (`scheduled`, `completed`, `cancelled`), and notes.
6. **`interview_questions`** *(Future-ready)*: Order index, category, question text.
7. **`interview_results`** *(Future-ready)*: Overall score, feedback summary, deepfake flags count, behavior metrics payload.

---

## 🚀 Getting Started

### 1. Backend Setup (FastAPI)

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

- API Documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- Interactive Open API: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

### 2. Frontend Setup (React / Vite)

```bash
cd frontend
npm install
npm run dev
```

- Web App: [http://localhost:5173](http://localhost:5173)

---

## 🔑 Demo Credentials (Pre-seeded)

| Role | Email | Password |
| :--- | :--- | :--- |
| **Interviewer** | `interviewer@platform.ai` | `password123` |
| **Candidate** | `candidate@platform.ai` | `password123` |
