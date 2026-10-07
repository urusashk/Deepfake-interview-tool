import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function InterviewerDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('interviews'); // 'interviews', 'create-interview', 'job-descriptions', 'candidates'
  const [interviews, setInterviews] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [jobDescriptions, setJobDescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Selected JD for filtering candidate matches
  const [filterJdId, setFilterJdId] = useState('');

  // Create Interview Form State
  const [interviewTitle, setInterviewTitle] = useState('');
  const [jobRole, setJobRole] = useState('');
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [selectedJdId, setSelectedJdId] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [interviewNotes, setInterviewNotes] = useState('');
  const [creatingInterview, setCreatingInterview] = useState(false);

  // Create Job Description Form State
  const [jdTitle, setJdTitle] = useState('');
  const [jdRoleCategory, setJdRoleCategory] = useState('');
  const [jdDescriptionText, setJdDescriptionText] = useState('');
  const [jdRequirements, setJdRequirements] = useState('');
  const [creatingJd, setCreatingJd] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [filterJdId]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      const [interviewsData, candidatesData, jdsData] = await Promise.all([
        api.getInterviewerInterviews(),
        api.getCandidates(filterJdId),
        api.getJobDescriptions(),
      ]);

      setInterviews(interviewsData);
      setCandidates(candidatesData);
      setJobDescriptions(jdsData);

      // Default candidate and JD selections if available
      if (candidatesData.length > 0 && !selectedCandidateId) {
        setSelectedCandidateId(candidatesData[0].id.toString());
      }
      if (jdsData.length > 0 && !selectedJdId) {
        setSelectedJdId(jdsData[0].id.toString());
        setJobRole(jdsData[0].title);
      }
      if (jdsData.length > 0 && !filterJdId) {
        setFilterJdId(jdsData[0].id.toString());
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch interviewer data');
    } finally {
      setLoading(false);
    }
  };

  const handleJdSelectChange = (e) => {
    const jdId = e.target.value;
    setSelectedJdId(jdId);
    const selected = jobDescriptions.find((j) => j.id.toString() === jdId);
    if (selected) {
      setJobRole(selected.title);
    }
  };

  const handleCreateInterview = async (e) => {
    e.preventDefault();
    if (!selectedCandidateId || !scheduledTime) {
      setError('Please select a candidate and scheduled time');
      return;
    }

    try {
      setCreatingInterview(true);
      setError('');
      setSuccessMsg('');

      await api.createInterview({
        title: interviewTitle || `${jobRole} - Technical Round`,
        job_role: jobRole || 'Software Engineer',
        candidate_id: parseInt(selectedCandidateId, 10),
        job_description_id: selectedJdId ? parseInt(selectedJdId, 10) : null,
        scheduled_time: new Date(scheduledTime).toISOString(),
        notes: interviewNotes,
      });

      setSuccessMsg('Interview scheduled successfully with automatic AI resume matching!');
      setInterviewTitle('');
      setInterviewNotes('');
      setScheduledTime('');
      setActiveTab('interviews');
      
      // Reload interviews
      const updatedInterviews = await api.getInterviewerInterviews();
      setInterviews(updatedInterviews);
    } catch (err) {
      setError(err.message || 'Failed to create interview');
    } finally {
      setCreatingInterview(false);
    }
  };

  const handleCreateJobDescription = async (e) => {
    e.preventDefault();
    try {
      setCreatingJd(true);
      setError('');
      setSuccessMsg('');

      await api.createJobDescription({
        title: jdTitle,
        role_category: jdRoleCategory,
        description_text: jdDescriptionText,
        requirements: jdRequirements,
      });

      setSuccessMsg('Job description created & analyzed successfully! Extracted required skills and requirements.');
      setJdTitle('');
      setJdRoleCategory('');
      setJdDescriptionText('');
      setJdRequirements('');

      // Reload JDs and candidates match table
      const updatedJds = await api.getJobDescriptions();
      setJobDescriptions(updatedJds);
      if (updatedJds.length > 0) {
        setFilterJdId(updatedJds[0].id.toString());
      }
    } catch (err) {
      setError(err.message || 'Failed to create job description');
    } finally {
      setCreatingJd(false);
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div>
          <div style={{ marginBottom: '1.5rem', padding: '0 0.5rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{user.full_name}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{user.email}</div>
            <span className="badge badge-role" style={{ marginTop: '0.5rem' }}>Interviewer</span>
          </div>

          <nav className="sidebar-nav">
            <button
              className={`nav-item ${activeTab === 'interviews' ? 'active' : ''}`}
              onClick={() => setActiveTab('interviews')}
            >
              <span>📅</span> Scheduled Interviews
            </button>
            <button
              className={`nav-item ${activeTab === 'candidates' ? 'active' : ''}`}
              onClick={() => setActiveTab('candidates')}
            >
              <span>👥</span> Candidates & AI Match
            </button>
            <button
              className={`nav-item ${activeTab === 'create-interview' ? 'active' : ''}`}
              onClick={() => setActiveTab('create-interview')}
            >
              <span>➕</span> Create Interview
            </button>
            <button
              className={`nav-item ${activeTab === 'job-descriptions' ? 'active' : ''}`}
              onClick={() => setActiveTab('job-descriptions')}
            >
              <span>💼</span> Job Descriptions
            </button>
          </nav>
        </div>

        <div style={{ fontSize: '0.75rem', color: '#94a3b8', padding: '0 0.5rem' }}>
          Phase 2 AI Matcher
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {error && <div className="alert alert-error">{error}</div>}
        {successMsg && <div className="alert alert-success">{successMsg}</div>}

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
            Loading interviewer workspace...
          </div>
        ) : (
          <>
            {/* TAB 1: SCHEDULED INTERVIEWS */}
            {activeTab === 'interviews' && (
              <div className="card">
                <div className="card-header">
                  <div>
                    <h2 className="card-title">Scheduled Interviews & Match Summary</h2>
                    <p className="card-description">All sessions with integrated AI Resume–JD alignment</p>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setActiveTab('create-interview')}
                  >
                    + Schedule New Interview
                  </button>
                </div>

                {interviews.length === 0 ? (
                  <div className="empty-state">
                    <span style={{ fontSize: '2rem' }}>📅</span>
                    <div className="empty-state-title">No interviews scheduled yet</div>
                    <div className="empty-state-desc">Click "+ Schedule New Interview" to arrange a session.</div>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Interview Title</th>
                          <th>Candidate</th>
                          <th>Role / JD</th>
                          <th>Resume Match</th>
                          <th>Scheduled Time</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {interviews.map((i) => (
                          <tr key={i.id}>
                            <td><strong>{i.title}</strong></td>
                            <td>
                              <div>{i.candidate_name || 'Candidate'}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{i.candidate_email}</div>
                            </td>
                            <td>
                              <div>{i.job_role}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{i.job_description_title || 'General'}</div>
                            </td>
                            <td>
                              {i.match_score ? (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#f0fdf4', color: '#15803d', padding: '3px 8px', borderRadius: '6px', fontWeight: 600, fontSize: '0.825rem', border: '1px solid #bbf7d0' }}>
                                  <span>{Math.round(i.match_score.overall_match_score)}%</span>
                                </div>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Pending resume</span>
                              )}
                            </td>
                            <td>{new Date(i.scheduled_time).toLocaleString()}</td>
                            <td>
                              <span className="badge badge-scheduled">{i.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: CANDIDATE LIST & AI RESUME MATCHING */}
            {activeTab === 'candidates' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div>
                      <h2 className="card-title">Candidate Evaluation & Resume Matching</h2>
                      <p className="card-description">Compare candidates against selected job description using semantic AI analysis</p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Compare With Job:</label>
                      <select
                        className="form-select"
                        style={{ width: 'auto', minWidth: '220px' }}
                        value={filterJdId}
                        onChange={(e) => setFilterJdId(e.target.value)}
                      >
                        {jobDescriptions.map((jd) => (
                          <option key={jd.id} value={jd.id}>
                            {jd.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {candidates.length === 0 ? (
                    <div className="empty-state">
                      <span style={{ fontSize: '2rem' }}>👥</span>
                      <div className="empty-state-title">No registered candidates yet</div>
                      <div className="empty-state-desc">Candidates will appear here automatically once registered.</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {candidates.map((cand) => (
                        <div key={cand.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.5rem', backgroundColor: '#ffffff', boxShadow: 'var(--shadow-sm)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <h3 style={{ fontSize: '1.2rem', color: '#0f172a' }}>{cand.full_name}</h3>
                                <span className="badge badge-role">{cand.experience_years} Yrs Exp</span>
                              </div>
                              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                {cand.email} {cand.phone && `• ${cand.phone}`}
                              </p>
                              {cand.headline && (
                                <p style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 500, marginTop: '0.2rem' }}>
                                  {cand.headline}
                                </p>
                              )}
                            </div>

                            {/* Main Match Header Score */}
                            {cand.match_score ? (
                              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.6rem 1.2rem', textAlign: 'right' }}>
                                <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>Resume Match</div>
                                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#2563eb', lineHeight: 1.2 }}>
                                  {Math.round(cand.match_score.overall_match_score)}%
                                </div>
                              </div>
                            ) : (
                              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                                No resume uploaded
                              </div>
                            )}
                          </div>

                          {/* Candidate Match Breakdown Card */}
                          {cand.match_score && (
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', marginTop: '1rem' }}>
                              {/* 4 Dimension Metrics */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '0.6rem 0.85rem', borderRadius: '6px' }}>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Skills</div>
                                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>{Math.round(cand.match_score.skills_match_score)}%</div>
                                </div>
                                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '0.6rem 0.85rem', borderRadius: '6px' }}>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Experience</div>
                                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>{Math.round(cand.match_score.experience_match_score)}%</div>
                                </div>
                                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '0.6rem 0.85rem', borderRadius: '6px' }}>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Education</div>
                                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>{Math.round(cand.match_score.education_match_score)}%</div>
                                </div>
                                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '0.6rem 0.85rem', borderRadius: '6px' }}>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Projects</div>
                                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>{Math.round(cand.match_score.projects_match_score)}%</div>
                                </div>
                              </div>

                              {/* Matching and Missing Skills lists */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem', marginBottom: '1rem' }}>
                                {cand.match_score.matching_skills?.length > 0 && (
                                  <div>
                                    <strong style={{ color: '#166534' }}>✓ Matching Skills: </strong>
                                    <span style={{ color: '#334155' }}>{cand.match_score.matching_skills.join(', ')}</span>
                                  </div>
                                )}
                                {cand.match_score.missing_skills?.length > 0 && (
                                  <div>
                                    <strong style={{ color: '#b91c1c' }}>⚠ Missing / Required Skills: </strong>
                                    <span style={{ color: '#64748b' }}>{cand.match_score.missing_skills.join(', ')}</span>
                                  </div>
                                )}
                              </div>

                              {/* Short AI Generated Candidate Summary */}
                              {cand.match_score.ai_summary && (
                                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.85rem', color: '#334155' }}>
                                  <span style={{ fontWeight: 600, color: '#2563eb' }}>AI Candidate Summary: </span>
                                  {cand.match_score.ai_summary}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Actions */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', gap: '0.75rem' }}>
                            <button
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => {
                                setSelectedCandidateId(cand.id.toString());
                                if (filterJdId) setSelectedJdId(filterJdId);
                                setActiveTab('create-interview');
                              }}
                            >
                              Schedule Interview with Candidate
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: CREATE INTERVIEW */}
            {activeTab === 'create-interview' && (
              <div className="card" style={{ maxWidth: '750px' }}>
                <div className="card-header">
                  <div>
                    <h2 className="card-title">Create & Schedule Interview</h2>
                    <p className="card-description">Assign candidates, select roles, and specify interview timings</p>
                  </div>
                </div>

                {candidates.length === 0 ? (
                  <div className="alert alert-info">
                    No candidates found in the system. Ask candidates to register first or view the Candidate List.
                  </div>
                ) : (
                  <form onSubmit={handleCreateInterview}>
                    <div className="form-group">
                      <label className="form-label">Interview Title</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Frontend Specialist - Technical Round 1"
                        className="form-input"
                        value={interviewTitle}
                        onChange={(e) => setInterviewTitle(e.target.value)}
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Link to Job Description</label>
                        <select
                          className="form-select"
                          value={selectedJdId}
                          onChange={handleJdSelectChange}
                        >
                          <option value="">-- Select Job Description (Optional) --</option>
                          {jobDescriptions.map((jd) => (
                            <option key={jd.id} value={jd.id}>
                              {jd.title} ({jd.role_category})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Job Role</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Senior Frontend Engineer"
                          className="form-input"
                          value={jobRole}
                          onChange={(e) => setJobRole(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Select Candidate</label>
                        <select
                          className="form-select"
                          required
                          value={selectedCandidateId}
                          onChange={(e) => setSelectedCandidateId(e.target.value)}
                        >
                          {candidates.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.full_name} ({c.email})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Date & Time</label>
                        <input
                          type="datetime-local"
                          required
                          className="form-input"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Interview Instructions / Notes</label>
                      <textarea
                        placeholder="Provide details or questions focus for this session..."
                        className="form-textarea"
                        value={interviewNotes}
                        onChange={(e) => setInterviewNotes(e.target.value)}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setActiveTab('interviews')}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={creatingInterview}
                      >
                        {creatingInterview ? 'Scheduling...' : 'Schedule Interview'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* TAB 4: JOB DESCRIPTIONS & STRUCTURED ANALYSIS */}
            {activeTab === 'job-descriptions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h2 className="card-title">Create & Analyze Job Description</h2>
                      <p className="card-description">Author job expectations with automatic NLP extraction of requirements</p>
                    </div>
                  </div>

                  <form onSubmit={handleCreateJobDescription}>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Job Title</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Lead Machine Learning Engineer"
                          className="form-input"
                          value={jdTitle}
                          onChange={(e) => setJdTitle(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Role Category</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Engineering, Product, Data Science"
                          className="form-input"
                          value={jdRoleCategory}
                          onChange={(e) => setJdRoleCategory(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Job Description Overview</label>
                      <textarea
                        required
                        placeholder="Detailed explanation of the job scope, responsibilities, and team mission..."
                        className="form-textarea"
                        value={jdDescriptionText}
                        onChange={(e) => setJdDescriptionText(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Key Requirements, Preferred Skills & Experience</label>
                      <textarea
                        placeholder="e.g. 4+ years Python, FastAPI, Docker, PyTorch. Preferred: Kubernetes, TypeScript..."
                        className="form-textarea"
                        value={jdRequirements}
                        onChange={(e) => setJdRequirements(e.target.value)}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={creatingJd}
                      >
                        {creatingJd ? 'Analyzing & Saving...' : 'Save & Analyze Job Description'}
                      </button>
                    </div>
                  </form>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div>
                      <h2 className="card-title">Job Descriptions & Extracted Requirements ({jobDescriptions.length})</h2>
                      <p className="card-description">Structured parameters used for candidate AI resume matching</p>
                    </div>
                  </div>

                  {jobDescriptions.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-title">No job descriptions added yet</div>
                      <div className="empty-state-desc">Create your first job description using the form above.</div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
                      {jobDescriptions.map((jd) => (
                        <div key={jd.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', backgroundColor: '#fafbfc' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                            <div>
                              <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{jd.title}</h3>
                              <span className="badge badge-role" style={{ marginTop: '0.25rem' }}>{jd.role_category}</span>
                            </div>
                          </div>
                          
                          <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.75rem', lineHeight: 1.4 }}>
                            {jd.description_text}
                          </p>

                          {/* Extracted Structured Parameters */}
                          {jd.parsed_data && (
                            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
                              {jd.parsed_data.required_skills?.length > 0 && (
                                <div>
                                  <strong style={{ color: '#0f172a' }}>Required Skills: </strong>
                                  <span style={{ color: '#2563eb' }}>{jd.parsed_data.required_skills.join(', ')}</span>
                                </div>
                              )}
                              {jd.parsed_data.preferred_skills?.length > 0 && (
                                <div>
                                  <strong style={{ color: '#0f172a' }}>Preferred Skills: </strong>
                                  <span style={{ color: '#64748b' }}>{jd.parsed_data.preferred_skills.join(', ')}</span>
                                </div>
                              )}
                              {jd.parsed_data.experience_requirements && (
                                <div>
                                  <strong style={{ color: '#0f172a' }}>Experience Req: </strong>
                                  <span style={{ color: '#475569' }}>{jd.parsed_data.experience_requirements.text}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
