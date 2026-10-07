import re
from typing import Dict, Any, List
from app.ai.resume_parser import extract_skills_and_technologies, DEGREE_PATTERNS

def analyze_job_description(title: str, description_text: str, requirements: str = "") -> Dict[str, Any]:
    """
    Phase 2 Job Description Analysis:
    Extracts required skills, preferred skills, experience requirements,
    education requirements, responsibilities, and tools/technologies.
    """
    full_text = f"{title}\n{description_text}\n{requirements}"
    skills_extracted = extract_skills_and_technologies(full_text)
    
    # Differentiate required vs preferred
    all_skills = skills_extracted["skills"]
    all_tech = skills_extracted["technologies"]
    
    required_skills = []
    preferred_skills = []

    # Check preferred context
    lines = full_text.split("\n")
    is_preferred_section = False
    
    for line in lines:
        l_low = line.lower()
        if any(w in l_low for w in ["preferred", "nice to have", "plus", "bonus", "optional"]):
            is_preferred_section = True
        elif any(w in l_low for w in ["required", "must have", "qualifications", "minimum", "responsibilities"]):
            is_preferred_section = False
            
        for skill in all_skills:
            if skill.lower() in l_low:
                if is_preferred_section and skill not in preferred_skills:
                    preferred_skills.append(skill)
                elif not is_preferred_section and skill not in required_skills:
                    required_skills.append(skill)

    # If all landed in one bucket, balance naturally
    if not required_skills and all_skills:
        required_skills = all_skills
    if not preferred_skills and len(required_skills) > 4:
        preferred_skills = required_skills[-2:]
        required_skills = required_skills[:-2]

    # Extract Experience Requirements
    min_exp_years = 0.0
    exp_matches = re.findall(r"(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+experience", full_text, re.IGNORECASE)
    if exp_matches:
        try:
            min_exp_years = max([float(m) for m in exp_matches if float(m) < 30])
        except ValueError:
            min_exp_years = 2.0
    elif "senior" in title.lower() or "lead" in title.lower():
        min_exp_years = 5.0
    elif "junior" in title.lower() or "intern" in title.lower():
        min_exp_years = 0.0
    else:
        min_exp_years = 2.0

    # Extract Education Requirements
    education_reqs = []
    for line in lines:
        for pattern in DEGREE_PATTERNS:
            match = re.search(pattern, line)
            if match:
                deg = match.group(0).strip()
                if deg not in education_reqs:
                    education_reqs.append(deg)
    if not education_reqs:
        education_reqs = ["Bachelor's degree in Computer Science, Engineering, or related discipline"]

    # Extract Responsibilities
    responsibilities = []
    capture_resp = False
    for line in lines:
        l_strip = line.strip()
        l_low = l_strip.lower()
        if any(h in l_low for h in ["responsibilities", "what you will do", "duties", "the role", "what you'll do"]):
            capture_resp = True
            continue
        if capture_resp and any(h in l_low for h in ["requirements", "qualifications", "preferred", "benefits", "about us"]):
            capture_resp = False
        if capture_resp and len(l_strip) > 10:
            responsibilities.append(l_strip.lstrip("•-* 1234567890."))

    if not responsibilities:
        # Fallback to key sentence chunks
        sentences = [s.strip() for s in description_text.split(".") if len(s.strip()) > 15]
        responsibilities = sentences[:4]

    return {
        "required_skills": required_skills,
        "preferred_skills": preferred_skills,
        "experience_requirements": {
            "min_years": min_exp_years,
            "text": f"{int(min_exp_years) if min_exp_years.is_integer() else min_exp_years}+ years relevant industry experience"
        },
        "education_requirements": education_reqs[:3],
        "responsibilities": responsibilities[:6],
        "technologies": all_tech
    }
