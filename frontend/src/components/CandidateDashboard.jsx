import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function CandidateDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('interviews'); // 'interviews', 'resumes', 'profile'
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
      setSuccessMsg('Resume uploaded successfully.');
      // Refresh profile data to see updated resume list
      const updatedProfile = await api.getCandidateProfile();
      setProfile(updatedProfile);
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
              <span>📅</span> My Interviews
            </button>
            <button
              className={`nav-item ${activeTab === 'resumes' ? 'active' : ''}`}
              onClick={() => setActiveTab('resumes')}
            >
              <span>📄</span> Resume Upload
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
          Phase 1 Foundation UI
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
            {/* TAB 1: INTERVIEWS */}
            {activeTab === 'interviews' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div>
                  <div className="card-header">
                    <div>
                      <h2 className="card-title">Upcoming Interviews</h2>
                      <p className="card-description">Interviews scheduled with hiring teams</p>
                    </div>
                  </div>

                  {upcomingInterviews.length === 0 ? (
                    <div className="empty-state">
                      <span style={{ fontSize: '2rem' }}>📅</span>
                      <div className="empty-state-title">No upcoming interviews scheduled</div>
                      <div className="empty-state-desc">You will be notified once an interviewer schedules a session.</div>
                    </div>
                  ) : (
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Interview Title</th>
                            <th>Job Role</th>
                            <th>Interviewer</th>
                            <th>Scheduled Date & Time</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {upcomingInterviews.map((item) => (
                            <tr key={item.id}>
                              <td><strong>{item.title}</strong></td>
                              <td>{item.job_role}</td>
                              <td>{item.interviewer_name || 'Hiring Lead'}</td>
                              <td>{new Date(item.scheduled_time).toLocaleString()}</td>
                              <td>
                                <span className="badge badge-scheduled">{item.status}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div>
                  <div className="card-header">
                    <div>
                      <h2 className="card-title">Previous Interviews</h2>
                      <p className="card-description">Past and completed interview history</p>
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
                            <th>Completed Date</th>
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
                      <h2 className="card-title">Upload Resume</h2>
                      <p className="card-description">Upload your updated resume in PDF or DOCX format</p>
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
                          Supported file types: .pdf, .docx (Max 10MB)
                        </div>
                      </label>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={!selectedFile || uploadingResume}
                      >
                        {uploadingResume ? 'Uploading...' : 'Upload Resume File'}
                      </button>
                    </div>
                  </form>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div>
                      <h2 className="card-title">Uploaded Resumes & Status</h2>
                      <p className="card-description">Files stored securely on the platform</p>
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
                            <th>Status</th>
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
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: CANDIDATE PROFILE */}
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
