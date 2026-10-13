import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import InterviewRoom from './InterviewRoom';
import InterviewAnalysisModal from './InterviewAnalysisModal';

export default function CandidateDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('notifications'); // 'notifications', 'interviews', 'resumes', 'parsed-view', 'profile'
  const [activeInterviewRoomId, setActiveInterviewRoomId] = useState(null);
  const [selectedAnalysisInterviewId, setSelectedAnalysisInterviewId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Profile Form state
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [headline, setHeadline] = useState('');
  const [skills, setSkills] = useState('');
  const [experienceYears, setExperienceYears] = useState(0);

  // Structured Profile Fields State
  const [educationList, setEducationList] = useState([]);
  const [experienceList, setExperienceList] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [certificationsList, setCertificationsList] = useState([]);

  // New item inputs
  const [newEduDegree, setNewEduDegree] = useState('');
  const [newEduContext, setNewEduContext] = useState('');
  const [newExpText, setNewExpText] = useState('');
  const [newProjTitle, setNewProjTitle] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');
  const [newCertText, setNewCertText] = useState('');

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
      const [profileData, interviewData, notifData] = await Promise.all([
        api.getCandidateProfile(),
        api.getCandidateInterviews(),
        api.getNotifications().catch(() => []),
      ]);

      setProfile(profileData);
      setInterviews(interviewData);
      setNotifications(notifData || []);

      if (profileData) {
        setFullName(profileData.full_name || user.full_name || '');
        setEmail(profileData.email || user.email || '');
        setPhone(profileData.phone || '');
        setHeadline(profileData.headline || '');
        setSkills(profileData.skills || '');
        setExperienceYears(profileData.experience_years || 0);
        setEducationList(profileData.education || []);
        setExperienceList(profileData.experience_details || []);
        setProjectsList(profileData.projects || []);
        setCertificationsList(profileData.certifications || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load candidate information');
    } finally {
      setLoading(false);
    }
  };

  const unreadNotifCount = notifications.filter(n => n.is_read === 0).length;

  const handleMarkAllNotificationsRead = async () => {
    try {
      await api.markNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error('Failed to mark notifications as read:', err);
    }
  };

  const handleMarkSingleNotificationRead = async (notifId) => {
    try {
      await api.markNotificationsRead([notifId]);
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: 1 } : n));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      setError('');
      setSuccessMsg('');
      const updated = await api.updateCandidateProfile({
        full_name: fullName,
        email: email,
        phone: phone,
        headline: headline,
        skills: skills,
        experience_years: parseFloat(experienceYears) || 0,
        education: educationList,
        experience_details: experienceList,
        projects: projectsList,
        certifications: certificationsList,
      });
      setProfile(updated);
      setSuccessMsg('Profile details synchronized and saved successfully.');
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddEducation = () => {
    if (!newEduDegree.trim()) return;
    setEducationList([...educationList, { degree: newEduDegree.trim(), raw_context: newEduContext.trim() }]);
    setNewEduDegree('');
    setNewEduContext('');
  };

  const handleRemoveEducation = (index) => {
    setEducationList(educationList.filter((_, idx) => idx !== index));
  };

  const handleAddExperience = () => {
    if (!newExpText.trim()) return;
    setExperienceList([...experienceList, newExpText.trim()]);
    setNewExpText('');
  };

  const handleRemoveExperience = (index) => {
    setExperienceList(experienceList.filter((_, idx) => idx !== index));
  };

  const handleAddProject = () => {
    if (!newProjTitle.trim()) return;
    setProjectsList([...projectsList, { title: newProjTitle.trim(), description: newProjDesc.trim() }]);
    setNewProjTitle('');
    setNewProjDesc('');
  };

  const handleRemoveProject = (index) => {
    setProjectsList(projectsList.filter((_, idx) => idx !== index));
  };

  const handleAddCert = () => {
    if (!newCertText.trim()) return;
    setCertificationsList([...certificationsList, newCertText.trim()]);
    setNewCertText('');
  };

  const handleRemoveCert = (index) => {
    setCertificationsList(certificationsList.filter((_, idx) => idx !== index));
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
      setSuccessMsg('Resume uploaded & parsed! Candidate profile has been automatically populated and synchronized.');
      
      // Refresh candidate profile, interviews & notifications
      const [updatedProfile, updatedInterviews, updatedNotifs] = await Promise.all([
        api.getCandidateProfile(),
        api.getCandidateInterviews(),
        api.getNotifications().catch(() => [])
      ]);
      setProfile(updatedProfile);
      setInterviews(updatedInterviews);
      setNotifications(updatedNotifs || []);

      if (updatedProfile) {
        setFullName(updatedProfile.full_name || fullName);
        setEmail(updatedProfile.email || email);
        setPhone(updatedProfile.phone || '');
        setHeadline(updatedProfile.headline || '');
        setSkills(updatedProfile.skills || '');
        setExperienceYears(updatedProfile.experience_years || 0);
        setEducationList(updatedProfile.education || []);
        setExperienceList(updatedProfile.experience_details || []);
        setProjectsList(updatedProfile.projects || []);
        setCertificationsList(updatedProfile.certifications || []);
      }
      setActiveTab('profile');
    } catch (err) {
      setError(err.message || 'Resume upload failed');
    } finally {
      setUploadingResume(false);
    }
  };

  if (activeInterviewRoomId) {
    return (
      <InterviewRoom
        interviewId={activeInterviewRoomId}
        user={user}
        onLeave={() => {
          setActiveInterviewRoomId(null);
          loadDashboardData();
        }}
        onInterviewCompleted={() => {
          setActiveInterviewRoomId(null);
          loadDashboardData();
        }}
      />
    );
  }

  const upcomingInterviews = interviews.filter(
    (i) => i.status.toLowerCase() === 'scheduled' || i.status.toLowerCase() === 'in_progress'
  );
  const previousInterviews = interviews.filter(
    (i) => i.status.toLowerCase() === 'completed'
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
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{fullName || user.full_name}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{email || user.email}</div>
            <span className="badge badge-role" style={{ marginTop: '0.5rem' }}>Candidate</span>
          </div>

          <nav className="sidebar-nav">
            <button
              className={`nav-item ${activeTab === 'notifications' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('notifications');
                if (unreadNotifCount > 0) {
                  handleMarkAllNotificationsRead();
                }
              }}
            >
              <span>🔔</span> Notifications
              {unreadNotifCount > 0 && (
                <span className="notif-badge-counter">{unreadNotifCount}</span>
              )}
            </button>
            <button
              className={`nav-item ${activeTab === 'interviews' ? 'active' : ''}`}
              onClick={() => setActiveTab('interviews')}
            >
              <span>📅</span> My Interviews & Matches
            </button>
            <button
              className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <span>👤</span> Candidate Profile
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
          </nav>
        </div>

        <div style={{ fontSize: '0.75rem', color: '#94a3b8', padding: '0 0.5rem' }}>
          IntervAI Platform
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
            {/* TAB: NOTIFICATIONS */}
            {activeTab === 'notifications' && (
              <div className="card">
                <div className="card-header">
                  <div>
                    <h2 className="card-title">Interview Notifications ({notifications.length})</h2>
                    <p className="card-description">Real-time alerts for scheduled interviews and updates</p>
                  </div>
                  {notifications.some(n => n.is_read === 0) && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleMarkAllNotificationsRead}
                    >
                      Mark All as Read
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="empty-state">
                    <span style={{ fontSize: '2.2rem' }}>🔔</span>
                    <div className="empty-state-title">No notifications yet</div>
                    <div className="empty-state-desc">When an interviewer schedules a session with you, you will see notifications here.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`notif-card ${notif.is_read === 0 ? 'unread' : 'read'}`}
                        onClick={() => notif.is_read === 0 && handleMarkSingleNotificationRead(notif.id)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.4rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {notif.is_read === 0 && <span className="notif-dot" title="Unread notification"></span>}
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>{notif.title}</h3>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className={`badge ${notif.is_read === 0 ? 'badge-scheduled' : 'badge-role'}`}>
                              {notif.is_read === 0 ? 'New' : 'Read'}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              {new Date(notif.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <p style={{ fontSize: '0.875rem', color: '#334155', marginBottom: '0.6rem', lineHeight: 1.45 }}>
                          {notif.message}
                        </p>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.8rem', color: '#64748b', background: '#ffffff', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          {notif.job_role && <div><strong>Job Role:</strong> {notif.job_role}</div>}
                          {notif.interviewer_name && <div><strong>Interviewer:</strong> {notif.interviewer_name}</div>}
                          {notif.scheduled_time && (
                            <div><strong>Date & Time:</strong> {new Date(notif.scheduled_time).toLocaleString()}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 1: INTERVIEWS & MATCH SCORES */}
            {activeTab === 'interviews' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div>
                  <div className="card-header">
                    <div>
                      <h2 className="card-title">Upcoming Interviews & Resume Matches</h2>
                      <p className="card-description">Assigned interview rounds with real-time AI JD matching metrics & live video room</p>
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
                                <span className={`badge ${item.status === 'in_progress' ? 'badge-role' : 'badge-scheduled'}`}>
                                  {item.status === 'in_progress' ? '● In Progress' : item.status}
                                </span>
                              </div>
                              <p style={{ fontSize: '0.875rem', color: '#475569' }}>
                                <strong>Role:</strong> {item.job_role} &nbsp;|&nbsp; <strong>Interviewer:</strong> {item.interviewer_name || 'Hiring Lead'} &nbsp;|&nbsp; <strong>Date:</strong> {new Date(item.scheduled_time).toLocaleString()}
                              </p>
                            </div>

                            {/* Actions: Join Room + AI Report + Match Badge */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                              <button
                                className="btn btn-primary btn-sm"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                                onClick={() => setActiveInterviewRoomId(item.id)}
                              >
                                <span>🎥</span> Join Interview Room
                              </button>

                              <button
                                className="btn btn-sm"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, background: '#4f46e5', color: '#ffffff', border: '1px solid #4338ca' }}
                                onClick={() => setSelectedAnalysisInterviewId(item.id)}
                              >
                                <span>🧠</span> AI Report
                              </button>

                              {item.match_score && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f0fdf4', padding: '0.45rem 0.85rem', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 600 }}>JD Match</div>
                                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#15803d' }}>
                                      {Math.round(item.match_score.overall_match_score)}%
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Match Breakdown Snippet */}
                          {item.match_score && (
                            <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                              <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.25rem' }}>Match Breakdown:</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', color: '#475569' }}>
                                <span>Skills: <strong>{Math.round(item.match_score.skills_match_score)}%</strong></span>
                                <span>Experience: <strong>{Math.round(item.match_score.experience_match_score)}%</strong></span>
                                <span>Domain/Projects: <strong>{Math.round(item.match_score.projects_match_score)}%</strong></span>
                              </div>
                              {item.match_score.ai_summary && (
                                <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#334155' }}>
                                  <strong>AI Summary:</strong> {item.match_score.ai_summary}
                                </p>
                              )}
                            </div>
                          )}

                          {item.notes && (
                            <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#64748b' }}>
                              <strong>Notes:</strong> {item.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {previousInterviews.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Past & Completed Interviews</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {previousInterviews.map((item) => (
                        <div key={item.id} className="card" style={{ opacity: 0.95 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <h4 style={{ margin: 0 }}>{item.title}</h4>
                                <span className="badge badge-completed">✓ Completed</span>
                              </div>
                              <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.2rem' }}>
                                Role: {item.job_role} &nbsp;|&nbsp; Date: {new Date(item.scheduled_time).toLocaleDateString()}
                              </p>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <button
                                className="btn btn-primary btn-sm"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: '#4f46e5', borderColor: '#4338ca' }}
                                onClick={() => setSelectedAnalysisInterviewId(item.id)}
                              >
                                <span>🧠</span> AI Evaluation Report
                              </button>

                              {item.recording_path && (
                                <a
                                  href={api.getRecordingUrl(item.id)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-secondary btn-sm"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                                >
                                  <span>📼</span> Recording
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: CANDIDATE PROFILE */}
            {activeTab === 'profile' && (
              <div className="card" style={{ maxWidth: '850px' }}>
                <div className="card-header">
                  <div>
                    <h2 className="card-title">Candidate Profile & Structured Details</h2>
                    <p className="card-description">Auto-populated from your resume and synchronized live with the interviewer</p>
                  </div>
                </div>

                <form onSubmit={handleProfileSave}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Full Name</label>
                      <input
                        type="text"
                        className="form-input"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Alex Chen"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Email Address</label>
                      <input
                        type="email"
                        className="form-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. candidate@platform.ai"
                      />
                    </div>
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
                      style={{ minHeight: '65px' }}
                      value={skills}
                      onChange={(e) => setSkills(e.target.value)}
                    />
                  </div>

                  {/* Section 1: Education */}
                  <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.75rem' }}>
                      🎓 Education & Degrees ({educationList.length})
                    </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.85rem' }}>
                      {educationList.map((edu, idx) => (
                        <div key={idx} className="profile-section-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong>{edu.degree}</strong> {edu.raw_context && <span style={{ color: '#64748b' }}>— {edu.raw_context}</span>}
                          </div>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                            onClick={() => handleRemoveEducation(idx)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="form-row" style={{ alignItems: 'flex-end' }}>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Degree / Qualification (e.g. B.S. Computer Science)"
                          value={newEduDegree}
                          onChange={(e) => setNewEduDegree(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="University / Context (e.g. Stanford University)"
                          value={newEduContext}
                          onChange={(e) => setNewEduContext(e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ height: '38px' }}
                        onClick={handleAddEducation}
                      >
                        + Add Education
                      </button>
                    </div>
                  </div>

                  {/* Section 2: Work Experience */}
                  <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.75rem' }}>
                      💼 Work Experience & Roles ({experienceList.length})
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.85rem' }}>
                      {experienceList.map((exp, idx) => (
                        <div key={idx} className="profile-section-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>{exp}</div>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                            onClick={() => handleRemoveExperience(idx)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Add role & company (e.g. Senior Software Engineer at TechCorp - 2021 to Present)"
                        value={newExpText}
                        onChange={(e) => setNewExpText(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ whiteSpace: 'nowrap' }}
                        onClick={handleAddExperience}
                      >
                        + Add Role
                      </button>
                    </div>
                  </div>

                  {/* Section 3: Projects */}
                  <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.75rem' }}>
                      🚀 Projects & Highlights ({projectsList.length})
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.85rem' }}>
                      {projectsList.map((proj, idx) => (
                        <div key={idx} className="profile-section-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <strong>{proj.title}</strong>
                            {proj.description && <p style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.2rem' }}>{proj.description}</p>}
                          </div>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            style={{ padding: '2px 8px', fontSize: '0.75rem', marginLeft: '1rem' }}
                            onClick={() => handleRemoveProject(idx)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Project Title (e.g. Real-Time Distributed Pipeline)"
                        value={newProjTitle}
                        onChange={(e) => setNewProjTitle(e.target.value)}
                      />
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Project Description & Tech Stack"
                          value={newProjDesc}
                          onChange={(e) => setNewProjDesc(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ whiteSpace: 'nowrap' }}
                          onClick={handleAddProject}
                        >
                          + Add Project
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Certifications */}
                  <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.75rem' }}>
                      📜 Certifications & Credentials ({certificationsList.length})
                    </h3>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.85rem' }}>
                      {certificationsList.map((cert, idx) => (
                        <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#f0fdf4', color: '#166534', padding: '4px 10px', borderRadius: '6px', border: '1px solid #bbf7d0', fontSize: '0.85rem' }}>
                          <span>{cert}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCert(idx)}
                            style={{ background: 'transparent', border: 'none', color: '#b91c1c', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Add Certification (e.g. AWS Certified Solutions Architect)"
                        value={newCertText}
                        onChange={(e) => setNewCertText(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ whiteSpace: 'nowrap' }}
                        onClick={handleAddCert}
                      >
                        + Add Certificate
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={savingProfile}
                    >
                      {savingProfile ? 'Saving & Synchronizing...' : 'Save & Synchronize Profile'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB: RESUME UPLOAD */}
            {activeTab === 'resumes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div className="card" style={{ maxWidth: '650px' }}>
                  <div className="card-header">
                    <div>
                      <h2 className="card-title">Upload Resume</h2>
                      <p className="card-description">Upload your PDF or DOCX resume to auto-populate your profile and enable AI JD matching</p>
                    </div>
                  </div>

                  <form onSubmit={handleResumeUpload}>
                    <div className="form-group">
                      <label className="form-label">Select Resume File (.pdf, .docx)</label>
                      <input
                        type="file"
                        required
                        accept=".pdf,.docx,.doc"
                        className="form-input"
                        onChange={(e) => setSelectedFile(e.target.files[0])}
                      />
                    </div>

                    {selectedFile && (
                      <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '1rem', fontSize: '0.85rem' }}>
                        <div><strong>Selected File:</strong> {selectedFile.name}</div>
                        <div style={{ color: '#64748b' }}>Size: {(selectedFile.size / 1024).toFixed(1)} KB</div>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={uploadingResume || !selectedFile}
                      >
                        {uploadingResume ? 'Extracting & Auto-Populating Profile...' : 'Upload & Auto-Populate Profile'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Uploaded Resumes List */}
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h2 className="card-title">Uploaded Resumes History</h2>
                      <p className="card-description">Previous resume versions used for role evaluation</p>
                    </div>
                  </div>

                  {(!profile?.resumes || profile.resumes.length === 0) ? (
                    <div className="empty-state">
                      <div className="empty-state-title">No resumes uploaded yet</div>
                      <div className="empty-state-desc">Upload your resume above to extract your details.</div>
                    </div>
                  ) : (
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>File Name</th>
                            <th>Type</th>
                            <th>Size</th>
                            <th>Status</th>
                            <th>Uploaded Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profile.resumes.map((r) => (
                            <tr key={r.id}>
                              <td><strong>{r.original_filename}</strong></td>
                              <td>{r.file_type.toUpperCase()}</td>
                              <td>{(r.file_size_bytes / 1024).toFixed(1)} KB</td>
                              <td>
                                <span className="badge badge-completed">{r.upload_status}</span>
                              </td>
                              <td>{new Date(r.uploaded_at).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: PARSED RESUME VIEW */}
            {activeTab === 'parsed-view' && (
              <div className="card">
                <div className="card-header">
                  <div>
                    <h2 className="card-title">Structured Resume Data Extraction</h2>
                    <p className="card-description">AI NLP extraction overview of your latest resume</p>
                  </div>
                </div>

                {!parsedData ? (
                  <div className="empty-state">
                    <div className="empty-state-title">No parsed resume available</div>
                    <div className="empty-state-desc">Upload a resume in the "Resume Upload" tab to view extracted information.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Contact & Bio Info */}
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{parsedData.name || fullName || 'Candidate Profile'}</h3>
                      <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        {parsedData.email || email} &nbsp;|&nbsp; {parsedData.phone || phone || 'Phone not detected'}
                      </p>
                      {parsedData.headline && (
                        <p style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 500, marginTop: '0.35rem' }}>
                          {parsedData.headline}
                        </p>
                      )}
                    </div>

                    {/* Skills Grid */}
                    <div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem', color: '#0f172a' }}>
                        Extracted Skills & Technologies ({parsedData.skills?.length || 0})
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {parsedData.skills?.map((skill, idx) => (
                          <span key={idx} className="badge badge-cat">
                            {skill}
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
            )}
          </>
        )}
      </main>

      {/* Phase 5 AI Interview Analysis & Evaluation Modal */}
      {selectedAnalysisInterviewId && (
        <InterviewAnalysisModal
          interviewId={selectedAnalysisInterviewId}
          onClose={() => {
            setSelectedAnalysisInterviewId(null);
            loadDashboardData();
          }}
        />
      )}
    </div>
  );
}

