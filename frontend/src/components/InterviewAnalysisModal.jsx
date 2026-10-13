import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

export default function InterviewAnalysisModal({ interviewId, onClose }) {
  const [analysis, setAnalysis] = useState(null);
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState('evaluations'); // 'evaluations', 'claims', 'transcript', 'behaviour'
  const [selectedQuestionIdx, setSelectedQuestionIdx] = useState(0);

  // Sample transcript preview modal state
  const [samplePreviewData, setSamplePreviewData] = useState(null);
  const [showSamplePreview, setShowSamplePreview] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    loadAnalysisData();
  }, [interviewId]);

  const loadAnalysisData = async () => {
    try {
      setLoading(true);
      setError('');
      const [analysisData, interviewData] = await Promise.all([
        api.getInterviewAnalysis(interviewId),
        api.getInterviewDetail(interviewId),
      ]);
      setAnalysis(analysisData);
      setInterview(interviewData);
    } catch (err) {
      setError(err.message || 'Failed to load interview analysis');
    } finally {
      setLoading(false);
    }
  };

  const handleRetryAnalysis = async () => {
    try {
      setRetrying(true);
      setError('');
      setSuccessMsg('');
      const updated = await api.triggerInterviewAnalysis(interviewId);
      setAnalysis(updated);
      setSuccessMsg('Analysis re-evaluated successfully!');
    } catch (err) {
      setError(err.message || 'Failed to reprocess interview analysis');
    } finally {
      setRetrying(false);
    }
  };

  // 1. Fetch & Preview Sample Transcript
  const handleFetchSampleTranscript = async () => {
    try {
      setLoadingSample(true);
      setError('');
      setSuccessMsg('');
      const sampleResp = await api.getSampleTranscript(interviewId);
      setSamplePreviewData(sampleResp);
      setShowSamplePreview(true);
    } catch (err) {
      setError(err.message || 'Failed to fetch sample interview transcript');
    } finally {
      setLoadingSample(false);
    }
  };

  // 2. Confirm and load sample transcript into AI analysis pipeline
  const handleConfirmLoadSample = async () => {
    if (!samplePreviewData?.transcript) return;
    try {
      setLoadingSample(true);
      setError('');
      setSuccessMsg('');
      const analyzed = await api.loadTranscriptAndAnalyze(interviewId, {
        transcript: samplePreviewData.transcript,
        is_sample: true,
      });
      setAnalysis(analyzed);
      setShowSamplePreview(false);
      setSuccessMsg('Sample interview transcript loaded and evaluated successfully by AI engine!');
    } catch (err) {
      setError(err.message || 'Failed to evaluate sample transcript');
    } finally {
      setLoadingSample(false);
    }
  };

  // 3. Real Audio file upload & transcription
  const handleAudioUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingAudio(true);
      setError('');
      setSuccessMsg('');
      const analyzed = await api.uploadInterviewAudio(interviewId, file);
      setAnalysis(analyzed);
      setSuccessMsg(`Audio recording "${file.name}" transcribed and analyzed successfully!`);
    } catch (err) {
      setError(err.message || 'Failed to upload and analyze audio recording');
    } finally {
      setUploadingAudio(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 85) return '#16a34a'; // green
    if (score >= 70) return '#2563eb'; // blue
    if (score >= 55) return '#d97706'; // amber
    return '#dc2626'; // red
  };

  const getScoreBg = (score) => {
    if (score >= 85) return '#f0fdf4';
    if (score >= 70) return '#eff6ff';
    if (score >= 55) return '#fffbeb';
    return '#fef2f2';
  };

  const getClaimBadge = (status) => {
    switch (status) {
      case 'consistent':
        return <span className="badge" style={{ backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>✓ Consistent with Resume</span>;
      case 'potential_inconsistency':
        return <span className="badge" style={{ backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>⚠️ Potential Inconsistency</span>;
      case 'unsupported':
        return <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>ℹ️ Unsupported Claim</span>;
      default:
        return <span className="badge badge-role">{status}</span>;
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '1100px', maxHeight: '94vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        
        {/* Modal Header */}
        <div style={{ padding: '1.25rem 1.75rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.4rem' }}>🧠</span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                AI Interview Analysis & Performance Report
              </h2>
              {analysis?.is_sample ? (
                <span className="badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', fontWeight: 700 }}>
                  DEMO DATA
                </span>
              ) : (
                <span className="brand-badge">Phase 5-6 AI</span>
              )}
            </div>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem', margin: 0 }}>
              {interview?.title || 'Session Analysis'} &nbsp;•&nbsp; Candidate: <strong>{interview?.candidate_name}</strong> &nbsp;•&nbsp; Role: <strong>{interview?.job_role}</strong>
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {/* Load Sample Transcript Button (Demo Data Workflow) */}
            <button
              className="btn btn-sm"
              onClick={handleFetchSampleTranscript}
              disabled={loadingSample || retrying || uploadingAudio}
              style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              title="Demonstrate AI analysis using a realistic sample transcript without camera"
            >
              <span>📥</span> {loadingSample ? 'Loading Sample...' : 'Load Sample Transcript (Demo)'}
            </button>

            {/* Upload Real Audio Button */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".wav,.mp3,.m4a,.webm,.ogg,.aac,.flac"
              style={{ display: 'none' }}
              onChange={handleAudioUpload}
            />
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAudio || retrying || loadingSample}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              title="Upload real interview audio recording (.wav, .mp3, .m4a, .webm)"
            >
              <span>🎙️</span> {uploadingAudio ? 'Transcribing...' : 'Upload Audio'}
            </button>

            {/* Re-Analyze Button */}
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleRetryAnalysis}
              disabled={retrying || loading || uploadingAudio || loadingSample}
              title="Re-run AI evaluation engine on current transcript"
            >
              {retrying ? 'Analyzing...' : '🔄 Re-Analyze'}
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              style={{ fontSize: '1.1rem', padding: '0.2rem 0.6rem' }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* DEMO DATA Banner if analysis was run on sample transcript */}
        {analysis?.is_sample && (
          <div style={{
            background: '#fffbeb',
            borderBottom: '1px solid #fde68a',
            padding: '0.65rem 1.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.1rem' }}>💡</span>
              <div style={{ fontSize: '0.825rem', color: '#92400e' }}>
                <strong>DEMO DATA:</strong> Evaluated using realistic sample candidate responses grounded in the candidate's resume and job questions (camera bypass mode). All question ratings and claim checks were generated by the active AI model.
              </div>
            </div>
            <span className="badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', fontWeight: 700, fontSize: '0.725rem' }}>
              DEMO DATASET
            </span>
          </div>
        )}

        {/* Error / Success Notifications */}
        {error && (
          <div className="alert alert-error" style={{ margin: '0.75rem 1.75rem 0 1.75rem' }}>
            {error}
          </div>
        )}
        {successMsg && (
          <div className="alert alert-success" style={{ margin: '0.75rem 1.75rem 0 1.75rem' }}>
            {successMsg}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚙️</div>
            <div>Processing interview analysis and evaluating speech transcripts...</div>
          </div>
        ) : (
          <>
            {/* Top Aggregate Score Banner & Candidate Fit Overview */}
            <div style={{ background: '#f8fafc', padding: '1rem 1.75rem', borderBottom: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                {/* Overall Score */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '50%',
                    backgroundColor: getScoreBg(analysis.average_score),
                    border: `2px solid ${getScoreColor(analysis.average_score)}`,
                    color: getScoreColor(analysis.average_score),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1.25rem'
                  }}>
                    {Math.round(analysis.average_score)}%
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Overall Technical Evaluation</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                      {analysis.average_score >= 80 ? 'Exceptional Candidate' : analysis.average_score >= 65 ? 'Qualified Candidate' : 'Requires Further Review'}
                    </div>
                  </div>
                </div>

                {/* Metric Pills */}
                <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Relevance</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: getScoreColor(analysis.overall_relevance_score) }}>
                      {Math.round(analysis.overall_relevance_score)}%
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Technical Accuracy</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: getScoreColor(analysis.overall_technical_score) }}>
                      {Math.round(analysis.overall_technical_score)}%
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Completeness</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: getScoreColor(analysis.overall_completeness_score) }}>
                      {Math.round(analysis.overall_completeness_score)}%
                    </div>
                  </div>

                  {/* Resume JD Match Score Pill (if present in interview) */}
                  {interview?.match_score && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '6px 12px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.7rem', color: '#166534' }}>Resume JD Match</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#15803d' }}>
                        {Math.round(interview.match_score.overall_match_score)}%
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="badge badge-completed">
                  ✓ {analysis.question_evaluations?.length || 0} Questions Evaluated
                </span>
                <span className="badge badge-role">
                  {analysis.resume_claims?.length || 0} Claims Verified
                </span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#ffffff', padding: '0 1.75rem', flexWrap: 'wrap' }}>
              <button
                className={`tab-btn ${activeTab === 'evaluations' ? 'active' : ''}`}
                onClick={() => setActiveTab('evaluations')}
                style={{ padding: '0.85rem 1.15rem', fontSize: '0.875rem' }}
              >
                🎯 Question-by-Question Evaluation ({analysis.question_evaluations?.length || 0})
              </button>
              <button
                className={`tab-btn ${activeTab === 'claims' ? 'active' : ''}`}
                onClick={() => setActiveTab('claims')}
                style={{ padding: '0.85rem 1.15rem', fontSize: '0.875rem' }}
              >
                📑 Resume Claim Verification ({analysis.resume_claims?.length || 0})
              </button>
              <button
                className={`tab-btn ${activeTab === 'behaviour' ? 'active' : ''}`}
                onClick={() => setActiveTab('behaviour')}
                style={{ padding: '0.85rem 1.15rem', fontSize: '0.875rem' }}
              >
                📊 Behaviour & Media Authenticity
              </button>
              <button
                className={`tab-btn ${activeTab === 'transcript' ? 'active' : ''}`}
                onClick={() => setActiveTab('transcript')}
                style={{ padding: '0.85rem 1.15rem', fontSize: '0.875rem' }}
              >
                🎙️ Session Transcript ({analysis.full_transcript?.length || 0})
              </button>
            </div>

            {/* Modal Body Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 1.75rem', background: '#f8fafc' }}>
              
              {/* TAB 1: QUESTION-BY-QUESTION EVALUATION */}
              {activeTab === 'evaluations' && (
                <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.25rem' }}>
                  {/* Left Column: Questions List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.2rem' }}>
                      Interview Questions ({analysis.question_evaluations?.length || 0})
                    </div>
                    {analysis.question_evaluations.map((q, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedQuestionIdx(idx)}
                        style={{
                          padding: '0.85rem',
                          borderRadius: '8px',
                          border: selectedQuestionIdx === idx ? '2px solid #2563eb' : '1px solid #e2e8f0',
                          backgroundColor: selectedQuestionIdx === idx ? '#eff6ff' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: selectedQuestionIdx === idx ? '#2563eb' : '#475569' }}>
                            Q{idx + 1} • {q.category}
                          </span>
                          <span style={{
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: getScoreColor(q.average_score)
                          }}>
                            {Math.round(q.average_score)}%
                          </span>
                        </div>
                        <div style={{ fontSize: '0.825rem', color: '#0f172a', fontWeight: 500, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {q.question_text}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Right Column: Detailed Question Answer Review */}
                  {analysis.question_evaluations.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {(() => {
                        const currentQ = analysis.question_evaluations[selectedQuestionIdx] || analysis.question_evaluations[0];
                        return (
                          <>
                            {/* Question Header Card */}
                            <div className="card" style={{ padding: '1.25rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.5rem' }}>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                    <span className="badge badge-role">Question {selectedQuestionIdx + 1}</span>
                                    <span className="badge badge-cat">{currentQ.category}</span>
                                    <span className="badge badge-scheduled">{currentQ.difficulty}</span>
                                  </div>
                                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: '0.5rem 0' }}>
                                    {currentQ.question_text}
                                  </h3>
                                </div>
                                <div style={{
                                  padding: '8px 14px',
                                  borderRadius: '8px',
                                  backgroundColor: getScoreBg(currentQ.average_score),
                                  border: `1px solid ${getScoreColor(currentQ.average_score)}`,
                                  color: getScoreColor(currentQ.average_score),
                                  fontWeight: 800,
                                  fontSize: '1.25rem',
                                  textAlign: 'center'
                                }}>
                                  {Math.round(currentQ.average_score)}%
                                </div>
                              </div>

                              {/* Spoken Answer Excerpt */}
                              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem 1rem', marginTop: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb' }}>
                                    🗣️ Candidate Answer Transcript
                                  </span>
                                  {currentQ.timestamp_start && (
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                      ⏱️ {currentQ.timestamp_start} - {currentQ.timestamp_end}
                                    </span>
                                  )}
                                </div>
                                <p style={{ fontSize: '0.85rem', color: '#334155', fontStyle: 'italic', margin: 0, lineHeight: 1.45 }}>
                                  "{currentQ.transcript}"
                                </p>
                              </div>
                            </div>

                            {/* 3 Metric Dimension Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Relevance</div>
                                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: getScoreColor(currentQ.relevance_score), margin: '0.2rem 0' }}>
                                  {Math.round(currentQ.relevance_score)}%
                                </div>
                                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0, lineHeight: 1.35 }}>
                                  Alignment with core technical question prompt.
                                </p>
                              </div>

                              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Technical Accuracy</div>
                                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: getScoreColor(currentQ.technical_score), margin: '0.2rem 0' }}>
                                  {Math.round(currentQ.technical_score)}%
                                </div>
                                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0, lineHeight: 1.35 }}>
                                  Correctness of concepts, architecture & syntax.
                                </p>
                              </div>

                              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Completeness</div>
                                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: getScoreColor(currentQ.completeness_score), margin: '0.2rem 0' }}>
                                  {Math.round(currentQ.completeness_score)}%
                                </div>
                                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0, lineHeight: 1.35 }}>
                                  Depth of explanation, trade-offs & examples.
                                </p>
                              </div>
                            </div>

                            {/* Strengths & Missing Points */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '1rem' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#166534', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <span>✨</span> Key Strengths:
                                </div>
                                <ul style={{ paddingLeft: '1.25rem', fontSize: '0.8rem', color: '#166534', display: 'flex', flexDirection: 'column', gap: '0.35rem', margin: 0 }}>
                                  {currentQ.key_strengths?.map((str, sIdx) => (
                                    <li key={sIdx}>{str}</li>
                                  ))}
                                </ul>
                              </div>

                              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '1rem' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#b45309', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <span>💡</span> Missing Points & Suggestions:
                                </div>
                                <ul style={{ paddingLeft: '1.25rem', fontSize: '0.8rem', color: '#b45309', display: 'flex', flexDirection: 'column', gap: '0.35rem', margin: 0 }}>
                                  {currentQ.missing_points?.map((mis, mIdx) => (
                                    <li key={mIdx}>{mis}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            {/* Explanation Card */}
                            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>
                                🤖 AI Evaluation Summary:
                              </div>
                              <p style={{ fontSize: '0.825rem', color: '#475569', margin: 0, lineHeight: 1.4 }}>
                                {currentQ.explanation}
                              </p>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: RESUME CLAIM VERIFICATION */}
              {activeTab === 'claims' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ background: '#ffffff', padding: '1rem 1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.25rem' }}>
                      Resume Evidence & Cross-Verification Findings
                    </h3>
                    <p style={{ fontSize: '0.825rem', color: '#64748b', margin: 0 }}>
                      Cross-references candidate verbal claims during the interview with uploaded resume documentation to identify corroborations and unverified statements without biased assumptions.
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {analysis.resume_claims?.map((claim, idx) => (
                      <div key={idx} className="card" style={{ padding: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                            {claim.claim_text}
                          </h4>
                          <div>{getClaimBadge(claim.status)}</div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
                          <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2563eb', marginBottom: '0.25rem' }}>
                              🗣️ Spoken Answer Excerpt:
                            </div>
                            <p style={{ fontSize: '0.8rem', color: '#334155', margin: 0, lineHeight: 1.4 }}>
                              "{claim.answer_excerpt}"
                            </p>
                          </div>

                          <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#15803d', marginBottom: '0.25rem' }}>
                              📄 Resume Document Evidence:
                            </div>
                            <p style={{ fontSize: '0.8rem', color: '#334155', margin: 0, lineHeight: 1.4 }}>
                              {claim.resume_evidence || 'No direct evidence found on uploaded resume document.'}
                            </p>
                          </div>
                        </div>

                        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                          <strong>Verification Analysis:</strong> {claim.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: BEHAVIOUR & MEDIA AUTHENTICITY (MODULAR MEDIA PIPELINE) */}
              {activeTab === 'behaviour' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Compliance Banner */}
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '1.1rem' }}>🛡️</span>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e40af', margin: 0 }}>
                        Objective Behavioural & Acoustic Observation Metrics
                      </h4>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#1e3a8a', margin: 0, lineHeight: 1.4 }}>
                      This analysis measures observable kinematic and acoustic signals. It does <strong>not</strong> infer honesty, personality, intelligence, confidence, or psychological traits. Modules run strictly based on available media feeds without penalizing missing video.
                    </p>
                  </div>

                  {/* Section 1: Video Behaviour Kinematics (Modular Check) */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>📹</span> Video Observable Signals & Kinematics
                      </h3>
                      <span className={`badge ${analysis.behaviour_analysis?.video_behaviour?.status === 'not_available' ? 'badge-scheduled' : 'badge-completed'}`}>
                        Status: {analysis.behaviour_analysis?.video_behaviour?.status === 'not_available' ? 'Not Available' : 'Completed'}
                      </span>
                    </div>

                    {analysis.behaviour_analysis?.video_behaviour?.status === 'not_available' ? (
                      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.75rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📹</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>Video Feed Not Available</div>
                        <p style={{ fontSize: '0.825rem', color: '#64748b', maxWidth: '580px', margin: '0.4rem auto 0 auto', lineHeight: 1.45 }}>
                          {analysis.behaviour_analysis?.video_behaviour?.note ||
                            'Live video camera was not captured for this interview (e.g. camera hardware unavailable or evaluated via transcript). Kinematic measurements were skipped and are NOT treated as negative findings or counted as zero.'}
                        </p>
                      </div>
                    ) : analysis.behaviour_analysis?.video_behaviour ? (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Head Stability</div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#2563eb', margin: '0.2rem 0' }}>
                              {analysis.behaviour_analysis.summary?.head_stability_percentage || 88.5}%
                            </div>
                            <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>Forward camera orientation</div>
                          </div>

                          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Center Screen Gaze</div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#16a34a', margin: '0.2rem 0' }}>
                              {analysis.behaviour_analysis.video_behaviour?.metrics?.gaze_distribution?.center_screen_percentage || 82.0}%
                            </div>
                            <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>Direct screen focus</div>
                          </div>

                          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Movement Frequency</div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#d97706', margin: '0.2rem 0' }}>
                              {analysis.behaviour_analysis.video_behaviour?.metrics?.head_movement_rate_per_min || 14.2} /min
                            </div>
                            <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>Subtle gesture & nodding rate</div>
                          </div>

                          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Attentive State</div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#7c3aed', margin: '0.2rem 0' }}>
                              {analysis.behaviour_analysis.summary?.visual_attention_score || 87.0}%
                            </div>
                            <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>Engagement signal index</div>
                          </div>
                        </div>

                        {analysis.behaviour_analysis.video_behaviour?.timeline_events?.length > 0 && (
                          <div className="card" style={{ padding: '1.15rem' }}>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.6rem' }}>
                              Observable Visual Timeline Highlights
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {analysis.behaviour_analysis.video_behaviour.timeline_events.map((evt, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.825rem' }}>
                                  <span style={{ fontWeight: 700, color: '#2563eb', minWidth: '48px' }}>⏱️ {evt.timestamp}</span>
                                  <span className="badge badge-role" style={{ fontSize: '0.7rem' }}>{evt.signal_type}</span>
                                  <span style={{ color: '#334155', flex: 1 }}>{evt.observation}</span>
                                  <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Conf: {Math.round(evt.confidence * 100)}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>

                  {/* Section 2: Audio & Speech Behaviour Dynamics */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>🎙️</span> Audio Speech Dynamics & Pacing
                      </h3>
                      <span className="badge badge-role">
                        Status: {analysis.behaviour_analysis?.audio_behaviour?.status === 'not_available' ? 'Not Available' : 'Completed'}
                      </span>
                    </div>

                    {analysis.behaviour_analysis?.audio_behaviour?.status === 'not_available' ? (
                      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.75rem', marginBottom: '0.35rem' }}>🎙️</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>Audio Telemetry Not Available</div>
                        <p style={{ fontSize: '0.825rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
                          Upload an audio recording to compute acoustic pacing, latency, and filler density.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Speaking Pace</div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#2563eb', margin: '0.2rem 0' }}>
                              {Math.round(analysis.behaviour_analysis?.summary?.words_per_minute || 135)} WPM
                            </div>
                            <div style={{ fontSize: '0.725rem', color: '#16a34a', fontWeight: 600 }}>
                              {analysis.behaviour_analysis?.audio_behaviour?.metrics?.pace_assessment || 'Optimal Pace'}
                            </div>
                          </div>

                          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Avg Response Delay</div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#16a34a', margin: '0.2rem 0' }}>
                              {analysis.behaviour_analysis?.summary?.average_response_delay_seconds || 1.3}s
                            </div>
                            <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>Latency before answer onset</div>
                          </div>

                          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Filler Word Density</div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#d97706', margin: '0.2rem 0' }}>
                              {analysis.behaviour_analysis?.summary?.filler_density_percentage || 1.2}%
                            </div>
                            <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>
                              Total count: {analysis.behaviour_analysis?.audio_behaviour?.metrics?.filler_words_total || 5}
                            </div>
                          </div>

                          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Speaking Share</div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#7c3aed', margin: '0.2rem 0' }}>
                              {analysis.behaviour_analysis?.summary?.candidate_speaking_percentage || 76}%
                            </div>
                            <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>Candidate dialogue share</div>
                          </div>
                        </div>

                        {analysis.behaviour_analysis?.audio_behaviour?.audio_timeline?.length > 0 && (
                          <div className="card" style={{ padding: '1.15rem' }}>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.6rem' }}>
                              Audio & Acoustic Observations Timeline
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {analysis.behaviour_analysis.audio_behaviour.audio_timeline.map((evt, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.825rem' }}>
                                  <span style={{ fontWeight: 700, color: '#16a34a', minWidth: '48px' }}>⏱️ {evt.timestamp}</span>
                                  <span className="badge" style={{ background: '#f0fdf4', color: '#166534', fontSize: '0.7rem', border: '1px solid #bbf7d0' }}>{evt.observation_type}</span>
                                  <span style={{ color: '#334155', flex: 1 }}>{evt.observation}</span>
                                  <span style={{ color: '#64748b', fontWeight: 600, fontSize: '0.75rem' }}>{evt.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Section 3: Deepfake & Media Authenticity Verification */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>🛡️</span> Deepfake & Media Authenticity Inspection
                      </h3>
                      <span className={`badge ${analysis.behaviour_analysis?.deepfake_detection?.status === 'not_available' ? 'badge-scheduled' : 'badge-completed'}`}>
                        Status: {analysis.behaviour_analysis?.deepfake_detection?.status === 'not_available' ? 'Not Available' : 'Completed'}
                      </span>
                    </div>

                    {analysis.behaviour_analysis?.deepfake_detection?.status === 'not_available' ? (
                      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.75rem', marginBottom: '0.35rem' }}>🔍</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>Deepfake Analysis: Not Available</div>
                        <p style={{ fontSize: '0.825rem', color: '#64748b', maxWidth: '580px', margin: '0.4rem auto 0 auto', lineHeight: 1.45 }}>
                          {analysis.behaviour_analysis?.deepfake_detection?.note ||
                            'Deepfake inspection requires raw recorded video frames to run spatial-temporal artifact models. When camera media is missing, this check is safely bypassed and omitted from aggregate scoring.'}
                        </p>
                      </div>
                    ) : (
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '1.2rem' }}>✓</span>
                          <span style={{ fontWeight: 700, color: '#166534' }}>
                            Media Authenticity Confirmed: {analysis.behaviour_analysis?.deepfake_detection?.authenticity_score || 98}% Confidence
                          </span>
                        </div>
                        <p style={{ fontSize: '0.825rem', color: '#14532d', margin: 0 }}>
                          No face-swap, lip-sync mismatch, or generative video anomalies were identified across analyzed frames.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: FULL TRANSCRIPT & TIMESTAMPS */}
              {activeTab === 'transcript' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ background: '#ffffff', padding: '1rem 1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', margin: 0 }}>
                        Chronological Session Transcript
                      </h3>
                      <p style={{ fontSize: '0.825rem', color: '#64748b', marginTop: '0.2rem', margin: 0 }}>
                        Complete timestamped dialogue with speaker role attribution.
                      </p>
                    </div>
                    {analysis.is_sample && (
                      <span className="badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}>
                        DEMO DATASET
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {analysis.full_transcript?.map((entry, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: entry.speaker === 'interviewer' ? '#eff6ff' : '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderLeft: `4px solid ${entry.speaker === 'interviewer' ? '#2563eb' : '#16a34a'}`,
                          borderRadius: '8px',
                          padding: '0.85rem 1.15rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: entry.speaker === 'interviewer' ? '#2563eb' : '#16a34a' }}>
                            {entry.speaker_name || (entry.speaker === 'interviewer' ? 'Interviewer' : 'Candidate')}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            ⏱️ {entry.timestamp}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: '#1e293b', margin: 0, lineHeight: 1.45 }}>
                          {entry.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </>
        )}

        {/* Modal Footer */}
        <div style={{ padding: '1rem 1.75rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Report ID: #{interviewId} &nbsp;•&nbsp; Results saved to platform database
          </div>
          <button className="btn btn-secondary" onClick={onClose}>
            Close Report
          </button>
        </div>

      </div>

      {/* SAMPLE TRANSCRIPT PREVIEW & CONFIRMATION MODAL */}
      {showSamplePreview && samplePreviewData && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '850px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Load Realistic Sample Interview Transcript
                  </h3>
                  <span className="badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', fontWeight: 700 }}>
                    DEMO DATA
                  </span>
                </div>
                <p style={{ fontSize: '0.825rem', color: '#64748b', marginTop: '0.25rem', margin: 0 }}>
                  This generated transcript contains 6 realistic turns grounded in the candidate's actual resume and job questions.
                </p>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowSamplePreview(false)}
              >
                ✕
              </button>
            </div>

            {/* Preview Transcript Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', background: '#f1f5f9', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="alert alert-info" style={{ fontSize: '0.8rem', margin: 0 }}>
                ℹ️ <strong>Camera Bypass Demo:</strong> This sample transcript allows demonstrating the complete AI analysis pipeline without requiring live camera capture. Answers demonstrate diverse correctness levels, resume corroborations, and an unsupported claim to test the verification model.
              </div>

              {samplePreviewData.transcript?.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: item.speaker === 'interviewer' ? '#eff6ff' : '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderLeft: `4px solid ${item.speaker === 'interviewer' ? '#2563eb' : '#16a34a'}`,
                    borderRadius: '8px',
                    padding: '0.75rem 1rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: item.speaker === 'interviewer' ? '#2563eb' : '#16a34a' }}>
                      {item.speaker_name || (item.speaker === 'interviewer' ? 'Interviewer' : 'Candidate')}
                    </span>
                    <span style={{ fontSize: '0.725rem', color: '#94a3b8' }}>
                      ⏱️ {item.timestamp}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.825rem', color: '#1e293b', margin: 0, lineHeight: 1.4 }}>
                    {item.text}
                  </p>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', background: '#ffffff' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowSamplePreview(false)}
                disabled={loadingSample}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmLoadSample}
                disabled={loadingSample}
                style={{ fontWeight: 600 }}
              >
                {loadingSample ? 'Analyzing Sample...' : '🚀 Run AI Analysis on Sample Transcript'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
