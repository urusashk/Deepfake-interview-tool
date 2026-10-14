import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

export default function CandidateMockInterview({ profile, user }) {
  // Session States: 'setup' | 'in_progress' | 'feedback' | 'summary'
  const [sessionState, setSessionState] = useState('setup');
  const [jobRole, setJobRole] = useState(profile?.headline || 'Full Stack Developer');
  const [targetCount, setTargetCount] = useState(3);
  const [enableVoiceRead, setEnableVoiceRead] = useState(true);
  const [enableMicAnswer, setEnableMicAnswer] = useState(true);

  // Mock Session Data
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [candidateAnswer, setCandidateAnswer] = useState('');
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [answerEvaluations, setAnswerEvaluations] = useState([]);
  const [currentFeedback, setCurrentFeedback] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [loadingSession, setLoadingSession] = useState(false);
  const [sessionSecs, setSessionSecs] = useState(0);

  // Speech Recognition & Synthesis
  const [isMicListening, setIsMicListening] = useState(false);
  const [interimSpokenText, setInterimSpokenText] = useState('');
  const speechRecognizerRef = useRef(null);
  const timerRef = useRef(null);
  const isListeningActiveRef = useRef(false);

  // 1. Session Duration Timer
  useEffect(() => {
    if (sessionState === 'in_progress' || sessionState === 'feedback') {
      timerRef.current = setInterval(() => {
        setSessionSecs(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionState]);

  // 2. Format Seconds into MM:SS
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  // 3. Text-to-Speech (TTS): Read Question Aloud
  const speakQuestion = (text) => {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('TTS error:', e);
    }
  };

  // 4. Speech-to-Text (STT): Live Candidate Voice Dictation
  const startSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (speechRecognizerRef.current) {
      try {
        speechRecognizerRef.current.abort();
      } catch (e) {}
    }

    try {
      const recognizer = new SpeechRecognition();
      recognizer.continuous = true;
      recognizer.interimResults = true;
      recognizer.lang = 'en-US';

      recognizer.onstart = () => {
        setIsMicListening(true);
        isListeningActiveRef.current = true;
      };

      recognizer.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            const finalStr = res[0].transcript.trim();
            if (finalStr) {
              setCandidateAnswer(prev => prev ? `${prev} ${finalStr}` : finalStr);
              setInterimSpokenText('');
            }
          } else {
            interim += res[0].transcript;
          }
        }
        if (interim) {
          setInterimSpokenText(interim);
        }
      };

      recognizer.onerror = (e) => {
        console.warn('Mock recognizer event:', e.error);
        if (e.error === 'not-allowed') {
          setIsMicListening(false);
          isListeningActiveRef.current = false;
        }
      };

      recognizer.onend = () => {
        if (isListeningActiveRef.current) {
          try {
            recognizer.start();
            setIsMicListening(true);
          } catch (e) {
            setTimeout(() => {
              if (isListeningActiveRef.current) {
                try { recognizer.start(); setIsMicListening(true); } catch (err) {}
              }
            }, 300);
          }
        } else {
          setIsMicListening(false);
        }
      };

      recognizer.start();
      speechRecognizerRef.current = recognizer;
      isListeningActiveRef.current = true;
      setIsMicListening(true);
    } catch (err) {
      console.warn('Could not launch speech recognition:', err);
    }
  };

  const stopSpeechRecognition = () => {
    isListeningActiveRef.current = false;
    if (speechRecognizerRef.current) {
      try {
        speechRecognizerRef.current.abort();
      } catch (e) {}
      speechRecognizerRef.current = null;
    }
    setIsMicListening(false);
    setInterimSpokenText('');
  };

  // 5. Start Mock Session
  const handleStartMockSession = async () => {
    try {
      setLoadingSession(true);
      setErrorMsg('');
      const res = await api.generateMockInterview({
        job_role: jobRole,
        target_count: targetCount
      });

      if (!res.questions || res.questions.length === 0) {
        throw new Error('No practice questions could be generated. Please try again.');
      }

      setQuestions(res.questions);
      setCurrentQuestionIdx(0);
      setCandidateAnswer('');
      setAnswerEvaluations([]);
      setCurrentFeedback(null);
      setSessionSecs(0);
      setSessionState('in_progress');

      // Voice read first question if enabled
      if (enableVoiceRead && res.questions[0]) {
        setTimeout(() => speakQuestion(res.questions[0].question_text), 400);
      }

      // Start mic if enabled
      if (enableMicAnswer) {
        setTimeout(() => startSpeechRecognition(), 600);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to initialize mock interview.');
    } finally {
      setLoadingSession(false);
    }
  };

  // 6. Submit Answer for Evaluation
  const handleSubmitAnswer = async () => {
    if (!candidateAnswer.trim()) {
      setErrorMsg('Please speak or type your response before submitting.');
      return;
    }

    try {
      setSubmittingAnswer(true);
      setErrorMsg('');
      stopSpeechRecognition();

      const currQ = questions[currentQuestionIdx];
      const feedback = await api.evaluateMockAnswer({
        question_id: currQ.id,
        question_text: currQ.question_text,
        category: currQ.category,
        difficulty: currQ.difficulty,
        candidate_answer: candidateAnswer.trim()
      });

      setCurrentFeedback(feedback);
      setAnswerEvaluations(prev => [...prev, {
        question: currQ,
        answer: candidateAnswer.trim(),
        evaluation: feedback
      }]);

      setSessionState('feedback');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to evaluate your answer.');
    } finally {
      setSubmittingAnswer(false);
    }
  };

  // 7. Proceed to Next Question or Summary
  const handleNextQuestion = () => {
    setErrorMsg('');
    setCurrentFeedback(null);
    setCandidateAnswer('');
    setInterimSpokenText('');

    if (currentQuestionIdx < questions.length - 1) {
      const nextIdx = currentQuestionIdx + 1;
      setCurrentQuestionIdx(nextIdx);
      setSessionState('in_progress');

      const nextQ = questions[nextIdx];
      if (enableVoiceRead && nextQ) {
        setTimeout(() => speakQuestion(nextQ.question_text), 400);
      }
      if (enableMicAnswer) {
        setTimeout(() => startSpeechRecognition(), 600);
      }
    } else {
      // Completed all questions
      stopSpeechRecognition();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setSessionState('summary');
    }
  };

  // 8. End / Cancel Session
  const handleEndSession = () => {
    stopSpeechRecognition();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setSessionState('setup');
    setQuestions([]);
    setCurrentQuestionIdx(0);
    setCandidateAnswer('');
    setAnswerEvaluations([]);
    setCurrentFeedback(null);
    setErrorMsg('');
  };

  const currentQ = questions[currentQuestionIdx];

  // ==========================================
  // VIEW 1: PRE-SESSION SETUP
  // ==========================================
  if (sessionState === 'setup') {
    return (
      <div className="card" style={{ maxWidth: '850px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ marginBottom: '1.75rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              AI Mock Interview Practice
            </h2>
            <span className="badge badge-completed" style={{ fontSize: '0.75rem' }}>
              Autonomous Self-Practice
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
            Prepare for real recruiter interviews with personalized questions grounded in your technical skills. Receive instant scoring on technical accuracy, answer depth, and communication clarity.
          </p>
        </div>

        {errorMsg && (
          <div className="alert alert-error" style={{ marginBottom: '1.25rem', fontSize: '0.85rem' }}>
            {errorMsg}
          </div>
        )}

        {/* Configuration Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.4rem' }}>
              Target Job Role or Practice Domain
            </label>
            <input
              type="text"
              className="input-field"
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value)}
              placeholder="e.g. Full Stack Developer, Backend Engineer, Data Scientist"
            />
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              {['Full Stack Developer', 'Backend Engineer', 'Frontend Engineer', 'Python / AI Engineer', 'DevOps / Cloud'].map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setJobRole(role)}
                  className="btn btn-secondary btn-sm"
                  style={{
                    fontSize: '0.75rem',
                    padding: '3px 8px',
                    borderColor: jobRole === role ? '#2563eb' : '#e2e8f0',
                    backgroundColor: jobRole === role ? '#eff6ff' : '#ffffff',
                    color: jobRole === role ? '#2563eb' : '#475569'
                  }}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.4rem' }}>
              Practice Drill Length
            </label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="radio"
                  name="qCount"
                  checked={targetCount === 3}
                  onChange={() => setTargetCount(3)}
                />
                <span><strong>Quick Practice (3 Questions)</strong> - 5 to 8 minutes</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="radio"
                  name="qCount"
                  checked={targetCount === 5}
                  onChange={() => setTargetCount(5)}
                />
                <span><strong>Standard Mock (5 Questions)</strong> - 10 to 15 minutes</span>
              </label>
            </div>
          </div>

          {/* Interactive Modes */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
              Interactive Audio Controls
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.825rem', color: '#334155', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enableVoiceRead}
                onChange={(e) => setEnableVoiceRead(e.target.checked)}
              />
              <span><strong>AI Voice Interviewer:</strong> Automatically read questions aloud using voice synthesis.</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.825rem', color: '#334155', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enableMicAnswer}
                onChange={(e) => setEnableMicAnswer(e.target.checked)}
              />
              <span><strong>Speech-to-Text Dictation:</strong> Speak your answers into your microphone with live transcription.</span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleStartMockSession}
              disabled={loadingSession || !jobRole.trim()}
              style={{ padding: '0.65rem 1.75rem', fontWeight: 600 }}
            >
              {loadingSession ? 'Generating Personalized Questions...' : 'Start AI Mock Interview'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2 & 3: IN PROGRESS & FEEDBACK
  // ==========================================
  if (sessionState === 'in_progress' || sessionState === 'feedback') {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Session Top Bar */}
        <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span className="badge badge-completed" style={{ fontSize: '0.7rem' }}>
                Practice in Progress
              </span>
              <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#0f172a' }}>
                Question {currentQuestionIdx + 1} of {questions.length}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>•</span>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Role: <strong>{jobRole}</strong>
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#475569' }}>
              Elapsed: {formatTime(sessionSecs)}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleEndSession}
            >
              Exit Practice
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="alert alert-error" style={{ fontSize: '0.85rem' }}>
            {errorMsg}
          </div>
        )}

        {/* Active Question Panel */}
        <div className="card" style={{ borderLeft: '4px solid #2563eb', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="badge badge-role" style={{ fontSize: '0.7rem' }}>
                {currentQ?.category || 'Technical'}
              </span>
              <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '0.7rem' }}>
                {currentQ?.difficulty || 'Medium'}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', padding: '2px 8px' }}
              onClick={() => speakQuestion(currentQ?.question_text)}
              title="Read Question Aloud"
            >
              Listen to Question
            </button>
          </div>

          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.45 }}>
            "{currentQ?.question_text}"
          </h3>
        </div>

        {/* Answer Input Section (Only when in_progress) */}
        {sessionState === 'in_progress' && (
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
                Your Answer (Speak or Type):
              </label>

              {/* Microphone Status Indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  className="recording-dot"
                  style={{
                    backgroundColor: isMicListening ? '#22c55e' : '#94a3b8',
                    boxShadow: isMicListening ? '0 0 6px rgba(34, 197, 94, 0.7)' : 'none'
                  }}
                ></span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isMicListening ? '#166534' : '#64748b' }}>
                  {isMicListening ? 'Microphone Active' : 'Microphone Paused'}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                  onClick={isMicListening ? stopSpeechRecognition : startSpeechRecognition}
                >
                  {isMicListening ? 'Pause Mic' : 'Start Mic'}
                </button>
              </div>
            </div>

            {/* Live Dictation Banner */}
            {interimSpokenText && (
              <div style={{ background: '#f0fdf4', border: '1px dashed #86efac', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', color: '#166534', fontStyle: 'italic' }}>
                Speaking: "{interimSpokenText}..."
              </div>
            )}

            <textarea
              className="input-field"
              rows={6}
              value={candidateAnswer}
              onChange={(e) => setCandidateAnswer(e.target.value)}
              placeholder="Speak clearly into your microphone, or type your answer here. Include relevant design patterns, real-world examples, and trade-offs..."
              style={{ resize: 'vertical', lineHeight: 1.45, fontSize: '0.9rem' }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setCandidateAnswer('')}
                disabled={!candidateAnswer}
              >
                Clear
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmitAnswer}
                disabled={submittingAnswer || !candidateAnswer.trim()}
                style={{ padding: '0.55rem 1.5rem', fontWeight: 600 }}
              >
                {submittingAnswer ? 'Evaluating Answer...' : 'Submit Answer & Get Instant Feedback'}
              </button>
            </div>
          </div>
        )}

        {/* Answer Coaching Feedback Card (Shown after submitting) */}
        {sessionState === 'feedback' && currentFeedback && (
          <div className="card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.2rem 0' }}>
                  AI Coach Performance Feedback
                </h4>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Analysis of your answer for Question {currentQuestionIdx + 1}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ textAlign: 'center', background: '#f8fafc', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>OVERALL</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: currentFeedback.average_score >= 80 ? '#16a34a' : '#d97706' }}>
                    {currentFeedback.average_score}%
                  </div>
                </div>
              </div>
            </div>

            {/* Score Breakdown Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>RELEVANCE</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{currentFeedback.relevance_score}%</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>TECHNICAL PRECISION</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{currentFeedback.technical_score}%</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>COMPLETENESS</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{currentFeedback.completeness_score}%</div>
              </div>
            </div>

            {/* Your Submitted Answer Recap */}
            <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                Your Submitted Answer
              </div>
              <p style={{ fontSize: '0.825rem', color: '#1e293b', margin: 0, fontStyle: 'italic', lineHeight: 1.4 }}>
                "{candidateAnswer}"
              </p>
            </div>

            {/* Strengths & Missing Points */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.85rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', marginBottom: '0.4rem' }}>
                  Key Strengths
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8rem', color: '#14532d', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {currentFeedback.key_strengths?.map((st, i) => (
                    <li key={i}>{st}</li>
                  ))}
                </ul>
              </div>

              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '0.85rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309', marginBottom: '0.4rem' }}>
                  Areas for Improvement
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8rem', color: '#78350f', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {currentFeedback.missing_points?.map((mp, i) => (
                    <li key={i}>{mp}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Coach Summary */}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.85rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e40af', marginBottom: '0.25rem' }}>
                Coach Recommendation
              </div>
              <p style={{ margin: 0, fontSize: '0.825rem', color: '#1e3a8a', lineHeight: 1.4 }}>
                {currentFeedback.coach_feedback}
              </p>
            </div>

            {/* Next Action */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleNextQuestion}
                style={{ padding: '0.6rem 1.75rem', fontWeight: 600 }}
              >
                {currentQuestionIdx < questions.length - 1 ? 'Next Question →' : 'Finish & View Practice Summary'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW 4: PRACTICE SUMMARY REPORT
  // ==========================================
  if (sessionState === 'summary') {
    const totalAvg = answerEvaluations.length > 0
      ? Math.round(answerEvaluations.reduce((sum, item) => sum + item.evaluation.average_score, 0) / answerEvaluations.length)
      : 0;

    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Summary Header Card */}
        <div className="card" style={{ padding: '2rem', textAlign: 'center', background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)' }}>
          <div style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: 700,
            background: totalAvg >= 80 ? '#dcfce7' : '#fef3c7',
            color: totalAvg >= 80 ? '#15803d' : '#b45309',
            marginBottom: '0.75rem'
          }}>
            Practice Session Completed
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
            Overall Practice Score: {totalAvg}%
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#64748b', maxWidth: '600px', margin: '0 auto 1.5rem auto' }}>
            You completed {answerEvaluations.length} mock interview questions for the <strong>{jobRole}</strong> role in {formatTime(sessionSecs)}.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleStartMockSession}
            >
              Start Another Practice Drill
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleEndSession}
            >
              Back to Practice Setup
            </button>
          </div>
        </div>

        {/* Question-by-Question Detailed Review */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>
            Question-by-Question Diagnostic Review
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {answerEvaluations.map((item, idx) => (
              <div
                key={idx}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '1.1rem',
                  background: '#ffffff'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb' }}>
                      Question {idx + 1}
                    </span>
                    <span className="badge badge-role" style={{ fontSize: '0.675rem' }}>
                      {item.question.category}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: item.evaluation.average_score >= 80 ? '#16a34a' : '#d97706' }}>
                    Score: {item.evaluation.average_score}%
                  </span>
                </div>

                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                  "{item.question.question_text}"
                </p>

                <p style={{ fontSize: '0.8rem', color: '#475569', fontStyle: 'italic', margin: '0 0 0.6rem 0', background: '#f8fafc', padding: '6px 10px', borderRadius: '4px' }}>
                  Answer: "{item.answer}"
                </p>

                <p style={{ fontSize: '0.8rem', color: '#1e3a8a', margin: 0 }}>
                  <strong>Coach feedback:</strong> {item.evaluation.coach_feedback}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
