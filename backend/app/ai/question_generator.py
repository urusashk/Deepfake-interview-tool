import random
from typing import List, Dict, Any, Optional

# Knowledge base of question templates mapped across categories and difficulty levels
QUESTION_TEMPLATES = {
    "Technical": {
        "Easy": [
            "What are the core fundamentals and design principles behind {skill}?",
            "Can you explain how {skill} handles data structures or state management in everyday applications?",
            "What are the main advantages of using {skill} over alternative technologies in modern development?",
            "How do you configure and test a basic service built with {skill}?"
        ],
        "Medium": [
            "How would you optimize performance, memory utilization, or concurrency in a {skill}-based application?",
            "Can you describe how you implement asynchronous programming, error handling, and transaction management in {skill}?",
            "How do you design RESTful or RPC APIs with {skill} while ensuring security and scalability?",
            "What strategies do you use for unit testing, integration testing, and mocking dependencies in {skill}?"
        ],
        "Hard": [
            "How would you architect a fault-tolerant, high-throughput distributed pipeline using {skill} and microservices?",
            "In {skill}, how do you diagnose and resolve critical production bottlenecks such as race conditions, memory leaks, or deadlocks?",
            "How would you design a distributed caching and eventual consistency layer around {skill} in a multi-region deployment?"
        ]
    },
    "Resume/Project": {
        "Easy": [
            "In your project '{project}', what was your individual contribution and technical role?",
            "What key technologies and libraries did you choose for '{project}', and what motivated those choices?",
            "Can you walk us through the high-level architecture and user flow of '{project}'?"
        ],
        "Medium": [
            "What were the most challenging technical trade-offs or limitations you encountered while building '{project}'?",
            "How did you test, deploy, and monitor '{project}' in production or staging environments?",
            "If you had to rebuild '{project}' from scratch today with higher scale requirements, what architectural changes would you make?"
        ],
        "Hard": [
            "What scalability or data volume bottlenecks did you face in '{project}', and how did you engineer solutions to mitigate them?",
            "Can you explain a critical failure scenario that occurred during '{project}' and the root-cause analysis process you followed?"
        ]
    },
    "Role-Specific": {
        "Easy": [
            "What excites you most about the {role} role, and how does your background align with our technical stack?",
            "What industry best practices do you follow daily when working as a {role}?",
            "How do you keep yourself updated with evolving standards and tools relevant to a {role}?"
        ],
        "Medium": [
            "For a {role}, how do you balance rapid delivery of new features with technical debt and code quality?",
            "How do you approach API versioning, backward compatibility, and documentation for client consumers in this {role}?",
            "Given the requirement for {requirement}, how have you implemented similar architectures in previous positions?"
        ],
        "Hard": [
            "As a {role}, how would you lead a cross-functional migration from legacy systems to a modern cloud-native stack with zero downtime?",
            "How do you establish engineering excellence, CI/CD benchmarks, and security compliance across a team for {role} deliverables?"
        ]
    },
    "Experience-Based": {
        "Easy": [
            "Drawing from your {exp_years} years of experience, what technical domains or frameworks do you feel most proficient in?",
            "Can you share a brief overview of your most rewarding professional engineering role to date?",
            "How has your approach to software architecture evolved over your career?"
        ],
        "Medium": [
            "Reflecting on your past experience, can you describe a time when you refactored a complex codebase to improve maintainability?",
            "How do you handle ambiguous requirements from product stakeholders when designing a new feature?",
            "Can you discuss a time when you mentored a junior engineer or championed a new engineering standard?"
        ],
        "Hard": [
            "Tell us about a high-stakes technical decision where you had incomplete information. What was the outcome and what did you learn?",
            "How have you navigated significant architectural disagreements within senior engineering leadership?"
        ]
    },
    "Situational": {
        "Easy": [
            "How do you prioritize competing deadlines when multiple tasks require urgent attention?",
            "When collaborating with remote or distributed team members, what communication practices do you rely on?",
            "How do you approach giving and receiving feedback during code reviews?"
        ],
        "Medium": [
            "Suppose a critical production bug is detected 15 minutes before an executive demo. What exact triage steps would you take?",
            "How would you handle a situation where a key dependency in your stack has a critical security vulnerability reported upstream?",
            "If product requirements change mid-sprint, how do you adapt your engineering milestones without sacrificing code quality?"
        ],
        "Hard": [
            "Imagine an upstream service your application depends on experiences severe latency spikes during peak traffic. How do you design circuit-breaking and degradation strategies?",
            "How would you respond if your team is pressured to release a feature that you believe has critical unmitigated scalability risks?"
        ]
    }
}

def generate_personalized_questions(
    resume_parsed: Optional[Dict[str, Any]],
    jd_parsed: Optional[Dict[str, Any]],
    job_role: str = "Software Engineer",
    target_count: int = 8
) -> List[Dict[str, Any]]:
    """
    Phase 3 AI Question Generator.
    Produces a balanced, personalized question set combining:
    - Technical questions (based on candidate skills & JD required skills)
    - Resume/Project questions (based on extracted projects)
    - Role-Specific questions (based on JD title & requirements)
    - Experience-Based questions (based on candidate history & years)
    - Situational questions (real-world engineering problem solving)
    
    Each question includes category, difficulty (Easy/Medium/Hard), and order_index.
    """
    questions = []

    # 1. Extract Skills
    candidate_skills = resume_parsed.get("skills", []) if resume_parsed else []
    candidate_tech = resume_parsed.get("technologies", []) if resume_parsed else []
    all_cand_skills = candidate_skills + candidate_tech
    
    jd_req_skills = jd_parsed.get("required_skills", []) if jd_parsed else []
    jd_pref_skills = jd_parsed.get("preferred_skills", []) if jd_parsed else []
    all_jd_skills = jd_req_skills + jd_pref_skills

    # Overlap / priority skills
    primary_skills = [s for s in all_cand_skills if any(s.lower() in j.lower() for j in all_jd_skills)]
    if not primary_skills:
        primary_skills = all_jd_skills or all_cand_skills or ["Python", "FastAPI", "Distributed Systems"]

    # 2. Extract Projects
    projects = resume_parsed.get("projects", []) if resume_parsed else []
    project_titles = [p.get("title", "Core Systems Project") for p in projects if isinstance(p, dict)]
    if not project_titles:
        project_titles = ["High-Throughput Microservice Platform", "Candidate Analytics Engine"]

    # 3. Extract Experience
    exp_years = resume_parsed.get("work_experience", {}).get("estimated_years", 3) if resume_parsed else 3
    if isinstance(exp_years, (int, float)) and exp_years > 0:
        exp_years_str = f"{int(exp_years) if float(exp_years).is_integer() else exp_years}+"
    else:
        exp_years_str = "3+"

    # 4. Extract Key JD requirement
    req_text = "microservices and scalable API architecture"
    if jd_parsed and jd_parsed.get("requirements"):
        req_text = jd_parsed["requirements"][:60]

    # Helper to generate unique questions
    used_texts = set()

    def add_question(category: str, difficulty: str, text: str):
        if text not in used_texts:
            used_texts.add(text)
            questions.append({
                "question_text": text,
                "category": category,
                "difficulty": difficulty,
                "is_custom": 0
            })

    # --- CATEGORY 1: TECHNICAL (2-3 questions) ---
    skill_1 = primary_skills[0] if len(primary_skills) > 0 else "Python"
    skill_2 = primary_skills[1] if len(primary_skills) > 1 else (primary_skills[0] if primary_skills else "FastAPI")
    
    tech_easy_template = random.choice(QUESTION_TEMPLATES["Technical"]["Easy"])
    add_question("Technical", "Easy", tech_easy_template.format(skill=skill_1))

    tech_med_template = random.choice(QUESTION_TEMPLATES["Technical"]["Medium"])
    add_question("Technical", "Medium", tech_med_template.format(skill=skill_2))

    tech_hard_template = random.choice(QUESTION_TEMPLATES["Technical"]["Hard"])
    add_question("Technical", "Hard", tech_hard_template.format(skill=skill_1))

    # --- CATEGORY 2: RESUME / PROJECT (1-2 questions) ---
    proj_1 = project_titles[0] if len(project_titles) > 0 else "Core Application"
    proj_med_template = random.choice(QUESTION_TEMPLATES["Resume/Project"]["Medium"])
    add_question("Resume/Project", "Medium", proj_med_template.format(project=proj_1))

    if len(project_titles) > 1:
        proj_2 = project_titles[1]
        proj_hard_template = random.choice(QUESTION_TEMPLATES["Resume/Project"]["Hard"])
        add_question("Resume/Project", "Hard", proj_hard_template.format(project=proj_2))
    else:
        proj_easy_template = random.choice(QUESTION_TEMPLATES["Resume/Project"]["Easy"])
        add_question("Resume/Project", "Easy", proj_easy_template.format(project=proj_1))

    # --- CATEGORY 3: ROLE-SPECIFIC (1-2 questions) ---
    role_med_template = random.choice(QUESTION_TEMPLATES["Role-Specific"]["Medium"])
    add_question("Role-Specific", "Medium", role_med_template.format(role=job_role, requirement=req_text))

    role_hard_template = random.choice(QUESTION_TEMPLATES["Role-Specific"]["Hard"])
    add_question("Role-Specific", "Hard", role_hard_template.format(role=job_role))

    # --- CATEGORY 4: EXPERIENCE-BASED (1 question) ---
    exp_med_template = random.choice(QUESTION_TEMPLATES["Experience-Based"]["Medium"])
    add_question("Experience-Based", "Medium", exp_med_template.format(exp_years=exp_years_str))

    # --- CATEGORY 5: SITUATIONAL (1-2 questions) ---
    sit_med_template = random.choice(QUESTION_TEMPLATES["Situational"]["Medium"])
    add_question("Situational", "Medium", sit_med_template)

    sit_hard_template = random.choice(QUESTION_TEMPLATES["Situational"]["Hard"])
    add_question("Situational", "Hard", sit_hard_template)

    # Assign order indices
    for idx, q in enumerate(questions):
        q["order_index"] = idx + 1

    return questions[:target_count]
