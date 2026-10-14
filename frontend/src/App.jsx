import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import AuthModal from './components/AuthModal';
import CandidateDashboard from './components/CandidateDashboard';
import InterviewerDashboard from './components/InterviewerDashboard';
import { getUserInfo, getAuthToken, clearSession } from './services/api';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authModalConfig, setAuthModalConfig] = useState(null); // { mode: 'login', role: 'candidate' }

  useEffect(() => {
    const user = getUserInfo();
    const token = getAuthToken();
    if (user && token) {
      setCurrentUser(user);
    }
  }, []);

  const handleOpenAuth = (mode = 'login', defaultRole = 'candidate') => {
    setAuthModalConfig({ mode, defaultRole });
  };

  const handleAuthSuccess = (userData) => {
    const userObj = {
      ...userData,
      id: userData.id || userData.user_id,
      user_id: userData.id || userData.user_id,
    };
    setCurrentUser(userObj);
    setAuthModalConfig(null);
  };

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
  };

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <header className="navbar">
        <div className="brand-logo" onClick={() => !currentUser && setAuthModalConfig(null)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <span style={{ letterSpacing: '-0.02em', fontWeight: 700 }}>IntervAI</span>
          <span className="brand-badge">Enterprise AI</span>
        </div>

        <div className="nav-actions">
          {currentUser ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '0.5rem' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: currentUser.role === 'candidate' ? '#eff6ff' : '#f1f5f9',
                  color: currentUser.role === 'candidate' ? '#2563eb' : '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}>
                  {currentUser.full_name ? currentUser.full_name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.2 }}>
                    {currentUser.full_name}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'capitalize' }}>
                    {currentUser.role}
                  </span>
                </div>
              </div>

              <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
                Sign Out
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => handleOpenAuth('login', 'candidate')}
              >
                Sign In
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleOpenAuth('register', 'candidate')}
              >
                Get Started
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main View Selection */}
      {!currentUser ? (
        <LandingPage onSelectAuth={handleOpenAuth} />
      ) : currentUser.role === 'candidate' ? (
        <CandidateDashboard user={currentUser} />
      ) : (
        <InterviewerDashboard user={currentUser} />
      )}

      {/* Auth Modal */}
      {authModalConfig && (
        <AuthModal
          initialMode={authModalConfig.mode}
          defaultRole={authModalConfig.defaultRole}
          onClose={() => setAuthModalConfig(null)}
          onSuccess={handleAuthSuccess}
        />
      )}
    </div>
  );
}
