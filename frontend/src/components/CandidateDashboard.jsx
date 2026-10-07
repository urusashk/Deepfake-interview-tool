import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function CandidateDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('interviews'); // 'interviews', 'resumes', 'parsed-view', 'profile'
  const [profile, setProfile] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Profile Form state
  const [phone, setPhone] = useState('');
  const [headline, setHeadline] = useState('');
  const [skills, setSkills] = useState('');
  const [experienceYears, setExperienceYears] = useState(0);
  const [savingProfile, setSavingProfile] = useState(false);

  // Resume Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingResume, setUploadingResume] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      const [profileData, interviewData] = await Promise.all([
        api.getCandidateProfile(),
        api.getCandidateInterviews(),
      ]);

      setProfile(profileData);
      setInterviews(interviewData);

      if (profileData) {
        setPhone(profileData.phone || '');
        setHeadline(profileData.headline || '');
        setSkills(profileData.skills || '');
        setExperienceYears(profileData.experience_years || 0);
      }
    } catch (err) {
      setError(err.message || 'Failed to load candidate information');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      setError('');
      setSuccessMsg('');
      const updated = await api.updateCandidateProfile({
        phone,
        headline,
        skills,
        experience_years: parseFloat(experienceYears) || 0,
      });
      setProfile(updated);
      setSuccessMsg('Profile details updated successfully.');
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleResumeUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    try {
      setUploadingResume(true);
      setError('');
      setSuccessMsg('');
      await api.uploadResume(selectedFile);
      setSelectedFile(null);
      setSuccessMsg('Resume uploaded & parsed successfully! Structured details extracted.');
      // Refresh candidate profile & interview data
      const [updatedProfile, updatedInterviews] = await Promise.all([
        api.getCandidateProfile(),
        api.getCandidateInterviews()
      ]);
      setProfile(updatedProfile);
      setInterviews(updatedInterviews);
      setActiveTab('parsed-view');
    } catch (err) {
      setError(err.message || 'Resume upload failed');
    } finally {
      setUploadingResume(false);
    }
  };

  const upcomingInterviews = interviews.filter(
    (i) => i.status.toLowerCase() === 'scheduled'
  );
  const previousInterviews = interviews.filter(
    (i) => i.status.toLowerCase() !== 'scheduled'
  );

  const latestResume = profile?.resumes && profile.resumes.length > 0
    ? profile.resumes[profile.resumes.length - 1]
    : null;
  const parsedData = latestResume?.parsed_data;

  return (
    <div className="dashboard-layout">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div>
          <div style={{ marginBottom: '1.5rem', padding: '0 0.5rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{user.full_name}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{user.email}</div>
            <span className="badge badge-role" style={{ marginTop: '0.5rem' }}>Candidate</span>
          </div>

          <nav className="sidebar-nav">
            <button
              className={`nav-item ${activeTab === 'interviews' ? 'active' : ''}`}
              onClick={() => setActiveTab('interviews')}
            >
              <span>📅</span> My Interviews & Matches
            </button>
            <button
              className={`nav-item ${activeTab === 'resumes' ? 'active' : ''}`}
              onClick={() => setActiveTab('resumes')}
            >
              <span>📄</span> Resume Upload
            </button>
            <button
              className={`nav-item ${activeTab === 'parsed-view' ? 'active' : ''}`}
              onClick={() => setActiveTab('parsed-view')}
            >
              <span>🤖</span> Parsed Resume View
            </button>
            <button
              className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <span>👤</span> Candidate Profile
            </button>
          </nav>
        </div>

        <div style={{ fontSize: '0.75rem', color: '#94a3b8', padding: '0 0.5rem' }}>
          Phase 2 AI Matcher
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {error && <div className="alert alert-error">{error}</div>}
        {successMsg && <div className="alert alert-success">{successMsg}</div>}

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
            Loading candidate data...
          </div>
        ) : (
          <>
            {/* TAB 1: INTERVIEWS & MATCH SCORES */}
            {activeTab === 'interviews' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div>
                  <div className="card-header">
                    <div>
                      <h2 className="card-title">Upcoming Interviews & Resume Matches</h2>
                      <p className="card-description">Assigned interview rounds with real-time AI JD matching metrics</p>
                    </div>
                  </div>

                  {upcomingInterviews.length === 0 ? (
                    <div className="empty-state">
                      <span style={{ fontSize: '2rem' }}>📅</span>
                      <div className="empty-state-title">No upcoming interviews scheduled</div>
                      <div className="empty-state-desc">You will be notified once an interviewer schedules a session.</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {upcomingInterviews.map((item) => (
                        <div key={item.id} className="card" style={{ borderLeft: '4px solid #2563eb' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                <h3 style={{ fontSize: '1.15rem' }}>{item.title}</h3>
                                <span className="badge badge-scheduled">{item.status}</span>
                              </div>
                              <p style={{ fontSize: '0.875rem', color: '#475569' }}>
                                <strong>Role:</strong> {item.job_role} &nbsp;|&nbsp; <strong>Interviewer:</strong> {item.interviewer_name || 'Hiring Lead'} &nbsp;|&nbsp; <strong>Date:</strong> {new Date(item.scheduled_time).toLocaleString()}
                              </p>
                            </div>

                            {/* Match Score Badge */}
                            {item.match_score ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f0fdf4', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                                <div style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600 }}>
                                  Resume Match
                                </div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#15803d' }}>
                                  {Math.round(item.match_score.overall_match_score)}%
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.8rem', color: '#64748b', background: '#f8fafc', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                Upload resume for AI match
                              </div>
                            )}
                          </div>

                          {/* Detailed Match Score Breakdown if available */}
                          {item.match_score && (
                            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                                <div style={{ background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Skills Match</div>
                                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>{Math.round(item.match_score.skills_match_score)}%</div>
                                </div>
                                <div style={{ background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Experience</div>
                                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>{Math.round(item.match_score.experience_match_score)}%</div>
                                </div>
                                <div style={{ background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Education</div>
                                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>{Math.round(item.match_score.education_match_score)}%</div>
                                </div>
                                <div style={{ background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Projects/Domain</div>
                                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>{Math.round(item.match_score.projects_match_score)}%</div>
                                </div>
                              </div>

                              {item.match_score.matching_skills && item.match_score.matching_skills.length > 0 && (
                                <div style={{ marginBottom: '0.5rem', fontSize: '0.825rem' }}>
                                  <strong style={{ color: '#166534' }}>✓ Matching Skills: </strong>
                                  <span style={{ color: '#334155' }}>{item.match_score.matching_skills.join(', ')}</span>
                                </div>
                              )}

                              {item.match_score.missing_skills && item.match_score.missing_skills.length > 0 && (
                                <div style={{ fontSize: '0.825rem' }}>
                                  <strong style={{ color: '#b91c1c' }}>⚠ Recommended / Missing Skills: </strong>
                                  <span style={{ color: '#64748b' }}>{item.match_score.missing_skills.join(', ')}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="card-header">
                    <div>
                      <h2 className="card-title">Previous Interviews</h2>
                      <p className="card-description">Past interview records</p>
                    </div>
                  </div>

                  {previousInterviews.length === 0 ? (
                    <div className="empty-state">
                      <span style={{ fontSize: '2rem' }}>📜</span>
                      <div className="empty-state-title">No previous interviews found</div>
                      <div className="empty-state-desc">Your past interview evaluations and records will be shown here.</div>
                    </div>
                  ) : (
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Interview Title</th>
                            <th>Job Role</th>
                            <th>Interviewer</th>
                            <th>Date</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previousInterviews.map((item) => (
                            <tr key={item.id}>
                              <td><strong>{item.title}</strong></td>
                              <td>{item.job_role}</td>
                              <td>{item.interviewer_name || 'Hiring Lead'}</td>
                              <td>{new Date(item.scheduled_time).toLocaleDateString()}</td>
                              <td>
                                <span className="badge badge-completed">{item.status}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: RESUME UPLOAD */}
            {activeTab === 'resumes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h2 className="card-title">Upload & Parse Resume</h2>
                      <p className="card-description">Upload your resume in PDF or DOCX format for instant structured extraction</p>
                    </div>
                  </div>

                  <form onSubmit={handleResumeUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{
                      border: '2px dashed #cbd5e1',
                      borderRadius: '8px',
                      padding: '2rem',
                      textAlign: 'center',
                      backgroundColor: '#f8fafc',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="file"
                        id="resume-file-input"
                        accept=".pdf,.docx"
                        style={{ display: 'none' }}
                        onChange={(e) => setSelectedFile(e.target.files[0] || null)}
                      />
                      <label htmlFor="resume-file-input" style={{ cursor: 'pointer' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
                        <div style={{ fontWeight: 600, color: '#2563eb' }}>
                          {selectedFile ? selectedFile.name : 'Choose PDF or DOCX file to upload'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                          Automatic AI parsing: Skills, Education, Work Experience, Projects & Certifications
                        </div>
                      </label>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={!selectedFile || uploadingResume}
                      >
                        {uploadingResume ? 'Extracting & Parsing...' : 'Upload & Parse Resume'}
                      </button>
                    </div>
                  </form>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div>
                      <h2 className="card-title">Uploaded Resumes & Status</h2>
                      <p className="card-description">Files stored securely and processed for matching</p>
                    </div>
                  </div>

                  {!profile?.resumes || profile.resumes.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-title">No resumes uploaded yet</div>
                      <div className="empty-state-desc">Upload your resume above to share with interviewers.</div>
                    </div>
                  ) : (
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>File Name</th>
                            <th>Format</th>
                            <th>Size</th>
                            <th>Upload Date</th>
                            <th>Parsing Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profile.resumes.map((r) => (
                            <tr key={r.id}>
                              <td><strong>{r.original_filename}</strong></td>
                              <td><span className="badge badge-role">{r.file_type.toUpperCase()}</span></td>
                              <td>{(r.file_size_bytes / 1024).toFixed(1)} KB</td>
                              <td>{new Date(r.uploaded_at).toLocaleDateString()}</td>
                              <td>
                                <span className="badge badge-uploaded">{r.upload_status}</span>
                              </td>
                              <td>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setActiveTab('parsed-view')}
                                >
                                  View Parsed Data
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: PARSED RESUME VIEW */}
            {activeTab === 'parsed-view' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h2 className="card-title">Parsed Resume Structured View</h2>
                      <p className="card-description">
                        Extracted components from {latestResume?.original_filename || 'your resume'}
                      </p>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setActiveTab('resumes')}
                    >
                      Upload Another
                    </button>
                  </div>

                  {!parsedData ? (
                    <div className="empty-state">
                      <span style={{ fontSize: '2rem' }}>🤖</span>
                      <div className="empty-state-title">No parsed data available</div>
                      <div className="empty-state-desc">Upload a resume in the "Resume Upload" tab to view extracted information.</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {/* Skills & Tech */}
                      <div>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem', color: '#0f172a' }}>
                          Extracted Skills & Technologies ({parsedData.skills?.length || 0})
                        </h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                          {parsedData.skills?.map((s, idx) => (
                            <span key={idx} style={{ background: '#eff6ff', color: '#1e40af', padding: '3px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 500, border: '1px solid #dbeafe' }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Work Experience */}
                      <div>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem', color: '#0f172a' }}>
                          Work Experience ({parsedData.work_experience?.estimated_years || 0} Years Estimated)
                        </h4>
                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {parsedData.work_experience?.roles_and_companies?.length > 0 ? (
                            parsedData.work_experience.roles_and_companies.map((exp, idx) => (
                              <li key={idx} style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                                💼 {exp}
                              </li>
                            ))
                          ) : (
                            <li style={{ color: '#64748b', fontSize: '0.85rem' }}>Experience details detected from summary profile.</li>
                          )}
                        </ul>
                      </div>

                      {/* Education */}
                      <div>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem', color: '#0f172a' }}>
                          Education & Degrees
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {parsedData.education?.length > 0 ? (
                            parsedData.education.map((edu, idx) => (
                              <div key={idx} style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                                🎓 <strong>{edu.degree}</strong> {edu.raw_context && `— ${edu.raw_context}`}
                              </div>
                            ))
                          ) : (
                            <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Undergraduate / Bachelor level qualification.</div>
                          )}
                        </div>
                      </div>

                      {/* Projects */}
                      <div>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem', color: '#0f172a' }}>
                          Projects & Domain Highlights
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {parsedData.projects?.length > 0 ? (
                            parsedData.projects.map((proj, idx) => (
                              <div key={idx} style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                                🚀 <strong>{proj.title}</strong>
                                <p style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.2rem' }}>{proj.description}</p>
                              </div>
                            ))
                          ) : (
                            <div style={{ color: '#64748b', fontSize: '0.85rem' }}>General technical engineering and full-stack projects.</div>
                          )}
                        </div>
                      </div>

                      {/* Certifications */}
                      {parsedData.certifications && parsedData.certifications.length > 0 && (
                        <div>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem', color: '#0f172a' }}>
                            Certifications
                          </h4>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {parsedData.certifications.map((cert, idx) => (
                              <span key={idx} style={{ background: '#f0fdf4', color: '#166534', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid #bbf7d0' }}>
                                📜 {cert}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: CANDIDATE PROFILE */}
            {activeTab === 'profile' && (
              <div className="card" style={{ maxWidth: '750px' }}>
                <div className="card-header">
                  <div>
                    <h2 className="card-title">Candidate Profile Details</h2>
                    <p className="card-description">Manage your personal and professional profile</p>
                  </div>
                </div>

                <form onSubmit={handleProfileSave}>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input
                      type="text"
                      disabled
                      className="form-input"
                      value={user.full_name}
                      style={{ backgroundColor: '#f1f5f9' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      disabled
                      className="form-input"
                      value={user.email}
                      style={{ backgroundColor: '#f1f5f9' }}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Phone Number</label>
                      <input
                        type="text"
                        placeholder="+1 (555) 000-0000"
                        className="form-input"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Years of Experience</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder="0"
                        className="form-input"
                        value={experienceYears}
                        onChange={(e) => setExperienceYears(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Professional Headline</label>
                    <input
                      type="text"
                      placeholder="e.g. Senior Frontend Engineer | React & TypeScript"
                      className="form-input"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Key Skills (comma-separated)</label>
                    <textarea
                      placeholder="e.g. JavaScript, React, Python, FastAPI, Docker, PostgreSQL"
                      className="form-textarea"
                      value={skills}
                      onChange={(e) => setSkills(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={savingProfile}
                    >
                      {savingProfile ? 'Saving Changes...' : 'Save Profile'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
