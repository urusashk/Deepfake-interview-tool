import json
import re
from typing import Dict, Any, List
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

def calculate_semantic_similarity(text1: str, text2: str) -> float:
    """Calculate semantic/textual cosine similarity between two texts using TF-IDF n-grams."""
    if not text1.strip() or not text2.strip():
        return 0.5
    try:
        vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
        tfidf_matrix = vectorizer.fit_transform([text1, text2])
        sim = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
        return float(sim)
    except Exception:
        return 0.5

def match_resume_to_jd(resume_data: Dict[str, Any], jd_data: Dict[str, Any], resume_raw: str = "", jd_raw: str = "") -> Dict[str, Any]:
    """
    Phase 2 Semantic Resume-Job Description Matcher.
    Calculates:
    - Overall Match Score (%)
    - Skills Match (%)
    - Experience Match (%)
    - Education Match (%)
    - Project / Domain Match (%)
    - Matching Skills list
    - Missing Skills list
    - AI-generated candidate summary
    """
    resume_skills = set([s.lower() for s in resume_data.get("skills", []) + resume_data.get("technologies", [])])
    
    jd_required_skills = jd_data.get("required_skills", [])
    jd_preferred_skills = jd_data.get("preferred_skills", [])
    all_jd_skills = set([s.lower() for s in jd_required_skills + jd_preferred_skills])

    # 1. Skills Match Calculation
    matching_skills_list = []
    missing_skills_list = []

    for req_skill in jd_required_skills:
        req_lower = req_skill.lower()
        # Direct or semantic match
        if any(req_lower in s or s in req_lower for s in resume_skills):
            matching_skills_list.append(req_skill)
        else:
            missing_skills_list.append(req_skill)

    for pref_skill in jd_preferred_skills:
        pref_lower = pref_skill.lower()
        if any(pref_lower in s or s in pref_lower for s in resume_skills):
            if pref_skill not in matching_skills_list:
                matching_skills_list.append(pref_skill)

    if all_jd_skills:
        skills_score = (len(matching_skills_list) / max(len(all_jd_skills), 1)) * 100.0
    else:
        # Fallback to general skill count
        skills_score = min(len(resume_skills) * 15.0, 85.0)
    skills_score = max(min(round(skills_score, 1), 100.0), 20.0)

    # 2. Experience Match Calculation
    cand_exp = resume_data.get("work_experience", {}).get("estimated_years", 1.0)
    jd_exp_req = jd_data.get("experience_requirements", {}).get("min_years", 2.0)

    if jd_exp_req == 0:
        exp_score = 100.0
    elif cand_exp >= jd_exp_req:
        exp_score = 100.0
    else:
        exp_score = round((cand_exp / jd_exp_req) * 100.0, 1)
        exp_score = max(exp_score, 35.0)

    # 3. Education Match Calculation
    cand_edu = resume_data.get("education", [])
    jd_edu = jd_data.get("education_requirements", [])
    if not jd_edu or len(cand_edu) > 0:
        edu_score = 100.0
    else:
        edu_score = 75.0

    # 4. Project & Domain Semantic Match
    projects_text = " ".join([p.get("description", "") for p in resume_data.get("projects", [])])
    work_text = " ".join(resume_data.get("work_experience", {}).get("roles_and_companies", []))
    cand_domain_text = f"{projects_text} {work_text} {' '.join(resume_data.get('skills', []))} {resume_raw}"
    
    jd_domain_text = f"{' '.join(jd_data.get('responsibilities', []))} {' '.join(jd_data.get('technologies', []))} {jd_raw}"
    
    semantic_sim = calculate_semantic_similarity(cand_domain_text, jd_domain_text)
    # Scale semantic similarity into standard score space
    project_domain_score = round(min(max((semantic_sim * 100.0) + 40.0, 50.0), 98.0), 1)

    # 5. Overall Match Score (Weighted Synthesis)
    # Skills: 40%, Experience: 25%, Projects/Domain: 25%, Education: 10%
    overall_score = round(
        (skills_score * 0.40) +
        (exp_score * 0.25) +
        (project_domain_score * 0.25) +
        (edu_score * 0.10),
        1
    )

    # 6. Generate Short AI Candidate Summary
    matched_count = len(matching_skills_list)
    missing_count = len(missing_skills_list)
    
    if overall_score >= 80:
        fit_label = "Strong Fit"
        summary_verbiage = f"Candidate demonstrates strong technical alignment ({overall_score}%) with key proficiencies in {', '.join(matching_skills_list[:4]) if matching_skills_list else 'required core competencies'}. Meets or exceeds experience requirements."
    elif overall_score >= 60:
        fit_label = "Moderate Fit"
        summary_verbiage = f"Candidate has relevant core background ({overall_score}%) with strength in {', '.join(matching_skills_list[:3]) if matching_skills_list else 'software fundamentals'}. Potential growth areas include {', '.join(missing_skills_list[:2]) if missing_skills_list else 'advanced domain specialization'}."
    else:
        fit_label = "Partial Match"
        summary_verbiage = f"Candidate possesses foundational skills ({overall_score}%), but lacks specific exposure to {', '.join(missing_skills_list[:3]) if missing_skills_list else 'several core requirements'} for this job role."

    return {
        "overall_match_score": overall_score,
        "skills_match_score": skills_score,
        "experience_match_score": exp_score,
        "education_match_score": edu_score,
        "projects_match_score": project_domain_score,
        "matching_skills": matching_skills_list,
        "missing_skills": missing_skills_list,
        "ai_summary": summary_verbiage
    }
