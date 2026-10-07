# AI Interview Platform — Phase 3: AI Interview Question Generation & Management

A clean, modern, and minimal platform for AI-powered interview management and candidate evaluation built with **FastAPI**, **SQLAlchemy**, and **React (Vite)**.

---

## 🚀 Phase 3 Features Implemented

### 1. AI-Powered Personalized Question Generation ([question_generator.py](file:///c:/Users/URUSA%20SHAIKH/ai%20project/Deepfake-interview-tool/backend/app/ai/question_generator.py))
- Automatically creates personalized question sets tailored to the candidate's extracted resume details (skills, projects, work experience) and the target Job Description (required/preferred skills and role requirements).
- Balanced generation across **5 core categories**:
  - **Technical**: Fundamentals, API design, architecture, async systems, error handling.
  - **Resume/Project**: Specific queries directed at candidate projects, tech stack choices, trade-offs, and scaling bottlenecks.
  - **Role-Specific**: Domain requirements, best practices, leadership, and code review standards.
  - **Experience-Based**: Deep-dives into past roles, refactoring challenges, and architectural decisions.
  - **Situational**: Real-world engineering triage, outages, production deadlines, and security incidents.

### 2. Multi-Tier Difficulty Scoring
Every question is classified with a clear difficulty badge:
- **`Easy`** (Fundamentals & definitions)
- **`Medium`** (Implementation, concurrency, testing, refactoring)
- **`Hard`** (Distributed systems, race conditions, disaster recovery, leadership under pressure)

### 3. Comprehensive Question Management (Database Persisted)
- **Auto-Generation on Interview Creation**: Questions are generated once when the interview is scheduled and saved to the database.
- **Explicit Regeneration**: The interviewer can trigger fresh AI question regeneration via the `⚡ Regenerate AI Questions` button.
- **Inline Editing**: Modify question prompt, category, or difficulty level directly in the modal.
- **Question Deletion**: Remove questions with instantaneous database sync.
- **Custom Question Authoring**: Add interviewer-created questions marked with a `Custom` badge.

### 4. Interview Preparation Page / Modal ([InterviewDetailModal.jsx](file:///c:/Users/URUSA%20SHAIKH/ai%20project/Deepfake-interview-tool/frontend/src/components/InterviewDetailModal.jsx))
- Displays candidate name, role, scheduled date/time, and the **Phase 2 Resume Match Score (e.g. 84%)**.
- Shows full interactive list of questions with category badges, difficulty indicators, and full CRUD actions.

---

## 🔑 Demo Credentials (Pre-seeded)

| Role | Email | Password |
| :--- | :--- | :--- |
| **Interviewer** | `interviewer@platform.ai` | `password123` |
| **Candidate** | `candidate@platform.ai` | `password123` |
