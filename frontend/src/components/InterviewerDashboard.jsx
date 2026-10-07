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
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      const [interviewsData, candidatesData, jdsData] = await Promise.all([
        api.getInterviewerInterviews(),
        api.getCandidates(),
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

      setSuccessMsg('Interview scheduled successfully!');
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

      const newJd = await api.createJobDescription({
        title: jdTitle,
        role_category: jdRoleCategory,
        description_text: jdDescriptionText,
        requirements: jdRequirements,
      });

      setSuccessMsg('Job description created successfully!');
      setJdTitle('');
      setJdRoleCategory('');
      setJdDescriptionText('');
      setJdRequirements('');

      // Reload JDs
      const updatedJds = await api.getJobDescriptions();
      setJobDescriptions(updatedJds);
      if (!selectedJdId && updatedJds.length > 0) {
        setSelectedJdId(updatedJds[0].id.toString());
        setJobRole(updatedJds[0].title);
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
            <button
              className={`nav-item ${activeTab === 'candidates' ? 'active' : ''}`}
              onClick={() => setActiveTab('candidates')}
            >
              <span>👥</span> Candidate List
            </button>
          </nav>
        </div>

        <div style={{ fontSize: '0.75rem', color: '#94a3b8', padding: '0 0.5rem' }}>
          Phase 1 Foundation UI
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
                    <h2 className="card-title">Scheduled Interviews</h2>
                    <p className="card-description">All interview sessions managed by your team</p>
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
                          <th>Role</th>
                          <th>Job Description</th>
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
                            <td>{i.job_role}</td>
                            <td>{i.job_description_title || 'General'}</td>
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

            {/* TAB 2: CREATE INTERVIEW */}
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

            {/* TAB 3: JOB DESCRIPTIONS */}
            {activeTab === 'job-descriptions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h2 className="card-title">Create Job Description</h2>
                      <p className="card-description">Define role expectations and skill requirements</p>
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
                          placeholder="e.g. Engineering, Product, Design"
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
                        placeholder="Detailed explanation of the job scope and responsibilities..."
                        className="form-textarea"
                        value={jdDescriptionText}
                        onChange={(e) => setJdDescriptionText(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Key Requirements & Qualifications</label>
                      <textarea
                        placeholder="e.g. 5+ years with PyTorch, Transformer architectures, Python..."
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
                        {creatingJd ? 'Saving JD...' : 'Save Job Description'}
                      </button>
                    </div>
                  </form>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div>
                      <h2 className="card-title">Existing Job Descriptions ({jobDescriptions.length})</h2>
                      <p className="card-description">Job descriptions available for interview scheduling</p>
                    </div>
                  </div>

                  {jobDescriptions.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-title">No job descriptions added yet</div>
                      <div className="empty-state-desc">Create your first job description using the form above.</div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                      {jobDescriptions.map((jd) => (
                        <div key={jd.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', backgroundColor: '#fafbfc' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{jd.title}</h3>
                            <span className="badge badge-role">{jd.role_category}</span>
                          </div>
                          <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.75rem', lineHeight: 1.4 }}>
                            {jd.description_text}
                          </p>
                          {jd.requirements && (
                            <div style={{ fontSize: '0.8rem', color: '#64748b', background: '#ffffff', padding: '0.65rem', borderRadius: '4px', border: '1px solid #f1f5f9' }}>
                              <strong>Requirements:</strong> {jd.requirements}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: CANDIDATE LIST */}
            {activeTab === 'candidates' && (
              <div className="card">
                <div className="card-header">
                  <div>
                    <h2 className="card-title">Registered Candidates ({candidates.length})</h2>
                    <p className="card-description">Candidates ready for evaluation and interview scheduling</p>
                  </div>
                </div>

                {candidates.length === 0 ? (
                  <div className="empty-state">
                    <span style={{ fontSize: '2rem' }}>👥</span>
                    <div className="empty-state-title">No candidates found</div>
                    <div className="empty-state-desc">Registered candidates will appear here automatically.</div>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Candidate Name</th>
                          <th>Email Address</th>
                          <th>Registered Date</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {candidates.map((c) => (
                          <tr key={c.id}>
                            <td><strong>{c.full_name}</strong></td>
                            <td>{c.email}</td>
                            <td>{new Date(c.created_at).toLocaleDateString()}</td>
                            <td>
                              <button
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => {
                                  setSelectedCandidateId(c.id.toString());
                                  setActiveTab('create-interview');
                                }}
                              >
                                Schedule Interview
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
