# AI Interview Platform — Phase 2: AI Resume Analysis & Matching

A clean, modern, and minimal platform for AI-powered interview management and candidate evaluation built with **FastAPI**, **SQLAlchemy**, and **React (Vite)**.

---

## 🚀 Phase 2 Features Implemented

### 1. Resume Parsing ([resume_parser.py](file:///c:/Users/URUSA%20SHAIKH/ai%20project/Deepfake-interview-tool/backend/app/ai/resume_parser.py))
- **File Extraction**: Extracts raw text from PDF and DOCX uploads using `pypdf` and `python-docx`.
- **Entity Extraction**:
  - Skills & Technologies taxonomy identification
  - Education degrees and context
  - Work experience roles, companies, and estimated years
  - Key projects and domain highlights
  - Certifications
- **Structured Storage**: Saved in `Resume.raw_text` and `Resume.parsed_data` (JSON) in the database.
- **Candidate View**: Dedicated "Parsed Resume View" tab on the Candidate Dashboard.

### 2. Job Description Analysis ([jd_analyzer.py](file:///c:/Users/URUSA%20SHAIKH/ai%20project/Deepfake-interview-tool/backend/app/ai/jd_analyzer.py))
- Automatically extracts:
  - Required Skills
  - Preferred Skills
  - Experience Requirements
  - Education Requirements
  - Core Responsibilities & Technologies
- Stored in `JobDescription.parsed_data` for matching against candidate pools.

### 3. Semantic Resume–JD Matching ([matcher.py](file:///c:/Users/URUSA%20SHAIKH/ai%20project/Deepfake-interview-tool/backend/app/ai/matcher.py))
- Evaluates candidates against JDs across multiple dimensions:
  - **Overall Match Score (%)**
  - **Skills Match (%)**
  - **Experience Match (%)**
  - **Education Match (%)**
  - **Project/Domain Semantic Match (%)** using TF-IDF n-gram cosine similarity
  - **Matching Skills List**
  - **Missing / Required Skills List**
  - **AI Candidate Suitability Summary**

### 4. Dashboards
- **Interviewer Dashboard**:
  - Interactive "Candidates & AI Match" tab displaying score breakdowns, matched/missing skill pills, and AI candidate summaries.
  - Ability to switch target Job Descriptions for comparison.
  - Scheduled interviews table displaying live match scores.
- **Candidate Dashboard**:
  - Displays match scores and breakdown for each assigned interview/job.
  - Interactive parsed resume inspector.

---

## 🔑 Demo Credentials (Pre-seeded)

| Role | Email | Password |
| :--- | :--- | :--- |
| **Interviewer** | `interviewer@platform.ai` | `password123` |
| **Candidate** | `candidate@platform.ai` | `password123` |
