import os
import re
import json
from typing import Dict, Any, List
from pypdf import PdfReader
import docx

# Comprehensive taxonomy of skills, technologies, and tools for extraction
TECH_SKILLS_TAXONOMY = {
    # Programming Languages
    "python", "javascript", "typescript", "java", "c++", "c#", "c", "go", "golang", "rust", 
    "ruby", "php", "swift", "kotlin", "scala", "r", "dart", "sql", "html", "css", "bash", "shell",
    
    # Web / Frontend / Backend Frameworks & Libraries
    "react", "react.js", "next.js", "vue", "vue.js", "angular", "svelte", "nodejs", "node.js",
    "express", "express.js", "fastapi", "django", "flask", "spring", "spring boot", "asp.net",
    ".net", "laravel", "rails", "ruby on rails", "graphql", "rest api", "restful api", "tailwind",
    "tailwindcss", "bootstrap", "sass", "redux", "zustand", "prisma", "hibernate",
    
    # AI / ML / Data Science
    "machine learning", "deep learning", "nlp", "natural language processing", "computer vision",
    "tensorflow", "pytorch", "scikit-learn", "keras", "pandas", "numpy", "opencv", "huggingface",
    "transformers", "llm", "large language models", "rag", "langchain", "llamaindex", "genai",
    "generative ai", "deepfake detection", "bert", "gpt", "data analysis", "data engineering",
    
    # Databases & Caching
    "postgresql", "postgres", "mysql", "sqlite", "mongodb", "redis", "elasticsearch",
    "cassandra", "dynamodb", "mariadb", "neo4j", "supabase", "firebase",
    
    # Cloud, DevOps & Infrastructure
    "docker", "kubernetes", "k8s", "aws", "amazon web services", "azure", "gcp", "google cloud",
    "ci/cd", "github actions", "gitlab ci", "jenkins", "terraform", "ansible", "linux", "git",
    "nginx", "apache", "microservices", "serverless", "lambda",
    
    # Soft & Methodological Skills
    "agile", "scrum", "kanban", "system design", "distributed systems", "test driven development",
    "tdd", "clean architecture", "code review", "problem solving", "leadership", "communication"
}

DEGREE_PATTERNS = [
    r"(?i)\b(bachelor['’]?s?|b\.?s\.?|b\.?tech|b\.?e\.?|undergraduate)\b(?:\s+(?:in|of)\s+([a-zA-Z\s&]+))?",
    r"(?i)\b(master['’]?s?|m\.?s\.?|m\.?tech|m\.?e\.?|mba|postgraduate)\b(?:\s+(?:in|of)\s+([a-zA-Z\s&]+))?",
    r"(?i)\b(ph\.?d\.?|doctorate|doctoral)\b(?:\s+(?:in|of)\s+([a-zA-Z\s&]+))?",
    r"(?i)\b(associate['’]?s?|diploma)\b(?:\s+(?:in|of)\s+([a-zA-Z\s&]+))?"
]

CERT_PATTERNS = [
    r"(?i)\b(aws certified[a-zA-Z0-9\s\-]+)",
    r"(?i)\b(azure certified[a-zA-Z0-9\s\-]+)",
    r"(?i)\b(google cloud certified[a-zA-Z0-9\s\-]+)",
    r"(?i)\b(certified kubernetes[a-zA-Z0-9\s\-]+|cka|ckad)",
    r"(?i)\b(cisco certified[a-zA-Z0-9\s\-]+|ccna|ccnp)",
    r"(?i)\b(pmp|project management professional)",
    r"(?i)\b(certified scrum master|csm)",
    r"(?i)\b(comptia [a-zA-Z\+\s]+)"
]

def extract_text_from_file(file_path: str, file_type: str) -> str:
    """Extract raw text from PDF or DOCX file."""
    text = ""
    try:
        if file_type.lower() == "pdf":
            reader = PdfReader(file_path)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        elif file_type.lower() in ["docx", "doc"]:
            doc = docx.Document(file_path)
            for para in doc.paragraphs:
                if para.text.strip():
                    text += para.text + "\n"
            for table in doc.tables:
                for row in table.rows:
                    row_text = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                    if row_text:
                        text += " | ".join(row_text) + "\n"
    except Exception as e:
        print(f"Error extracting text from {file_path}: {e}")
        text = ""
    return text.strip()

def extract_skills_and_technologies(text: str) -> Dict[str, List[str]]:
    """Extract skills and technologies from text using knowledge base matching."""
    text_lower = text.lower()
    found_skills = set()
    found_tech = set()

    for item in TECH_SKILLS_TAXONOMY:
        # Match as whole word/phrase
        pattern = r'(?:\b|\W)' + re.escape(item) + r'(?:\b|\W)'
        if re.search(pattern, text_lower):
            # Format nicely
            capitalized = item.title() if len(item) > 3 and not item.isupper() else item.upper()
            if item in ["react", "fastapi", "django", "flask", "docker", "kubernetes", "aws", "azure", "gcp", "postgresql", "mongodb", "redis", "pytorch", "tensorflow", "graphql"]:
                found_tech.add(capitalized)
            found_skills.add(capitalized)

    return {
        "skills": sorted(list(found_skills)),
        "technologies": sorted(list(found_tech))
    }

def extract_education(text: str) -> List[Dict[str, str]]:
    """Identify degrees, majors, and educational mentions."""
    education_items = []
    lines = text.split("\n")
    
    for line in lines:
        for pattern in DEGREE_PATTERNS:
            match = re.search(pattern, line)
            if match:
                deg = match.group(0).strip()
                if len(deg) > 2 and deg not in [e.get("degree") for e in education_items]:
                    education_items.append({
                        "degree": deg,
                        "raw_context": line.strip()[:140]
                    })
    
    # If no specific regex match, check for keywords
    if not education_items:
        for line in lines:
            line_l = line.lower()
            if any(k in line_l for k in ["computer science", "information technology", "b.tech", "b.e", "m.tech", "bachelor", "master", "university", "institute of technology"]):
                if len(line.strip()) < 120 and line.strip() not in [e.get("raw_context") for e in education_items]:
                    education_items.append({
                        "degree": line.strip(),
                        "raw_context": line.strip()
                    })
    return education_items[:4]

def extract_experience(text: str) -> Dict[str, Any]:
    """Identify experience snippets, roles, and estimated years."""
    lines = text.split("\n")
    exp_snippets = []
    total_years = 0.0

    # Look for "X years of experience" or date spans
    year_patterns = [
        r"(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+experience",
        r"experience\s*:\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)"
    ]
    for pattern in year_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for m in matches:
            try:
                val = float(m)
                if val > total_years and val < 40:
                    total_years = val
            except ValueError:
                pass

    # Extract job section entries
    capture = False
    for line in lines:
        l_strip = line.strip()
        if not l_strip:
            continue
        l_lower = l_strip.lower()
        if any(h in l_lower for h in ["work experience", "professional experience", "employment history", "experience"]):
            capture = True
            continue
        if capture and any(h in l_lower for h in ["education", "skills", "projects", "certifications", "interests", "languages"]):
            capture = False

        if capture and len(l_strip) > 5:
            if any(role_word in l_lower for role_word in ["engineer", "developer", "lead", "architect", "manager", "specialist", "intern", "consultant", "analyst", "201", "202"]):
                exp_snippets.append(l_strip)

    return {
        "estimated_years": total_years if total_years > 0 else (3.0 if len(exp_snippets) > 1 else 1.0),
        "roles_and_companies": exp_snippets[:6]
    }

def extract_projects(text: str) -> List[Dict[str, str]]:
    """Identify projects section and project descriptions."""
    lines = text.split("\n")
    projects = []
    capture = False

    for line in lines:
        l_strip = line.strip()
        if not l_strip:
            continue
        l_lower = l_strip.lower()
        if any(h in l_lower for h in ["projects", "personal projects", "key projects", "academic projects"]):
            capture = True
            continue
        if capture and any(h in l_lower for h in ["experience", "education", "skills", "certifications", "achievements", "publications"]):
            capture = False

        if capture and len(l_strip) > 8:
            projects.append({
                "title": l_strip[:80],
                "description": l_strip
            })

    return projects[:5]

def extract_certifications(text: str) -> List[str]:
    """Identify certificates and licenses."""
    certs = []
    for pattern in CERT_PATTERNS:
        matches = re.findall(pattern, text)
        for m in matches:
            item = m.strip() if isinstance(m, str) else m[0].strip()
            if item and item not in certs:
                certs.append(item.title())
    
    # Also check certification section
    lines = text.split("\n")
    capture = False
    for line in lines:
        l_strip = line.strip()
        l_lower = l_strip.lower()
        if "certification" in l_lower or "licenses" in l_lower:
            capture = True
            continue
        if capture and any(h in l_lower for h in ["experience", "education", "skills", "projects", "languages"]):
            capture = False
        if capture and len(l_strip) > 5 and len(l_strip) < 90:
            if l_strip not in certs:
                certs.append(l_strip)

    return certs[:5]

def parse_resume_document(file_path: str, file_type: str, existing_headline: str = "") -> Dict[str, Any]:
    """
    Main entry point for Phase 2 Resume Parsing.
    Extracts text, skills, education, work experience, projects, certifications, and technologies.
    """
    raw_text = extract_text_from_file(file_path, file_type)
    
    # If text is minimal (e.g. empty or binary image PDF), create fallback structure
    if not raw_text or len(raw_text) < 20:
        raw_text = f"Resume Document: {os.path.basename(file_path)}\nHeadline: {existing_headline or 'Software Professional'}"

    skills_tech = extract_skills_and_technologies(raw_text)
    education = extract_education(raw_text)
    experience = extract_experience(raw_text)
    projects = extract_projects(raw_text)
    certifications = extract_certifications(raw_text)

    parsed_result = {
        "skills": skills_tech["skills"],
        "technologies": skills_tech["technologies"],
        "education": education,
        "work_experience": experience,
        "projects": projects,
        "certifications": certifications,
        "summary": raw_text[:300].replace("\n", " ").strip()
    }
    return {
        "raw_text": raw_text,
        "parsed_data": parsed_result
    }
