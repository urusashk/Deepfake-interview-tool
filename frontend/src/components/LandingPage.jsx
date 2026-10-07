import React from 'react';

export default function LandingPage({ onSelectAuth }) {
  return (
    <div style={{ padding: '3.5rem 1.5rem', maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'inline-block', padding: '0.35rem 1rem', background: '#eff6ff', color: '#2563eb', borderRadius: '16px', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1.25rem' }}>
          Phase 1 Foundation
        </div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem', letterSpacing: '-0.02em' }}>
          Next-Gen AI Interview Platform
        </h1>
        <p style={{ fontSize: '1.1rem', color: '#475569', maxWidth: '620px', margin: '0 auto', lineHeight: 1.6 }}>
          A secure, streamlined platform built for candidate evaluation, interview scheduling, resume management, and role-based workflows.
        </p>
      </div>

      {/* Role Selection Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.75rem', marginTop: '2.5rem', textAlign: 'left' }}>
        
        {/* Candidate Portal Card */}
        <div className="card" style={{ borderTop: '4px solid #2563eb', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span className="badge badge-role">Candidate Portal</span>
              <span style={{ fontSize: '1.25rem' }}>👤</span>
            </div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>For Candidates</h3>
            <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem', color: '#64748b' }}>
              Upload your resume (PDF/DOCX), build your professional profile, and track your scheduled and previous interview rounds.
            </p>
            <ul style={{ fontSize: '0.85rem', color: '#475569', listStylePosition: 'inside', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <li>Profile & skill management</li>
              <li>Secure resume upload & status</li>
              <li>Upcoming interview schedule</li>
            </ul>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={() => onSelectAuth('login', 'candidate')}
            >
              Candidate Login
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => onSelectAuth('register', 'candidate')}
            >
              Register
            </button>
          </div>
        </div>

        {/* Interviewer Portal Card */}
        <div className="card" style={{ borderTop: '4px solid #0f172a', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span className="badge badge-role">Interviewer Portal</span>
              <span style={{ fontSize: '1.25rem' }}>💼</span>
            </div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>For Interviewers & Recruiters</h3>
            <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem', color: '#64748b' }}>
              Create job descriptions, manage prospective candidates, and schedule technical and behavioral interviews seamlessly.
            </p>
            <ul style={{ fontSize: '0.85rem', color: '#475569', listStylePosition: 'inside', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <li>Job description authoring</li>
              <li>Candidate directory view</li>
              <li>Comprehensive interview scheduler</li>
            </ul>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1, backgroundColor: '#0f172a' }}
              onClick={() => onSelectAuth('login', 'interviewer')}
            >
              Interviewer Login
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => onSelectAuth('register', 'interviewer')}
            >
              Register
            </button>
          </div>
        </div>

      </div>

      {/* Demo helper card */}
      <div style={{ marginTop: '2.5rem', padding: '1.25rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', textAlign: 'left' }}>
        <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.5rem' }}>
          <strong>Quick Demo Accounts:</strong>
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', fontSize: '0.8rem', color: '#64748b' }}>
          <div>
            <strong>Interviewer:</strong> <code>interviewer@platform.ai</code> / <code>password123</code>
          </div>
          <div>
            <strong>Candidate:</strong> <code>candidate@platform.ai</code> / <code>password123</code>
          </div>
        </div>
      </div>
    </div>
  );
}
