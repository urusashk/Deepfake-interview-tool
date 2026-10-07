import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function InterviewDetailModal({ interviewId, onClose }) {
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  // Edit question state
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editCategory, setEditCategory] = useState('Technical');
  const [editDifficulty, setEditDifficulty] = useState('Medium');
  const [savingEdit, setSavingEdit] = useState(false);

  // Add custom question state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newCategory, setNewCategory] = useState('Technical');
  const [newDifficulty, setNewDifficulty] = useState('Medium');
  const [addingQuestion, setAddingQuestion] = useState(false);

  useEffect(() => {
    loadInterviewDetail();
  }, [interviewId]);

  const loadInterviewDetail = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.getInterviewDetail(interviewId);
      setInterview(data);
    } catch (err) {
      setError(err.message || 'Failed to load interview details');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateQuestions = async () => {
    if (!window.confirm('Regenerate AI questions? This will rebuild a fresh set of personalized questions.')) {
      return;
    }
    try {
      setRegenerating(true);
      setError('');
      setSuccessMsg('');
      const updatedQuestions = await api.regenerateQuestions(interviewId);
      setInterview((prev) => ({
        ...prev,
        questions: updatedQuestions,
      }));
      setSuccessMsg('AI questions regenerated successfully!');
    } catch (err) {
      setError(err.message || 'Failed to regenerate questions');
    } finally {
      setRegenerating(false);
    }
  };

  const handleStartEdit = (q) => {
    setEditingQuestionId(q.id);
    setEditText(q.question_text);
    setEditCategory(q.category || 'Technical');
    setEditDifficulty(q.difficulty || 'Medium');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editText.trim()) return;

    try {
      setSavingEdit(true);
      setError('');
      const updatedQ = await api.updateQuestion(editingQuestionId, {
        question_text: editText,
        category: editCategory,
        difficulty: editDifficulty,
      });

      setInterview((prev) => ({
        ...prev,
        questions: prev.questions.map((q) => (q.id === editingQuestionId ? updatedQ : q)),
      }));

      setEditingQuestionId(null);
      setSuccessMsg('Question updated successfully.');
    } catch (err) {
      setError(err.message || 'Failed to update question');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;

    try {
      setError('');
      await api.deleteQuestion(questionId);
      setInterview((prev) => ({
        ...prev,
        questions: prev.questions.filter((q) => q.id !== questionId),
      }));
      setSuccessMsg('Question removed from interview set.');
    } catch (err) {
      setError(err.message || 'Failed to delete question');
    }
  };

  const handleAddCustomQuestion = async (e) => {
    e.preventDefault();
    if (!newQuestionText.trim()) return;

    try {
      setAddingQuestion(true);
      setError('');
      const addedQ = await api.addCustomQuestion(interviewId, {
        question_text: newQuestionText,
        category: newCategory,
        difficulty: newDifficulty,
      });

      setInterview((prev) => ({
        ...prev,
        questions: [...prev.questions, addedQ],
      }));

      setNewQuestionText('');
      setShowAddForm(false);
      setSuccessMsg('Custom question added to interview set.');
    } catch (err) {
      setError(err.message || 'Failed to add custom question');
    } finally {
      setAddingQuestion(false);
    }
  };

  const getDifficultyBadgeClass = (diff) => {
    const d = (diff || '').toLowerCase();
    if (d === 'easy') return 'badge-diff-easy';
    if (d === 'hard') return 'badge-diff-hard';
    return 'badge-diff-medium';
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1.5rem',
      overflowY: 'auto'
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
        {/* Modal Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'transparent',
            border: 'none',
            fontSize: '1.25rem',
            cursor: 'pointer',
            color: '#64748b'
          }}
        >
          ✕
        </button>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            Loading interview preparation and question set...
          </div>
        ) : !interview ? (
          <div className="alert alert-error">Interview details not found.</div>
        ) : (
          <div>
            {/* Header / Meta */}
            <div style={{ marginBottom: '1.25rem', paddingRight: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <span className="badge badge-scheduled">{interview.status}</span>
                <span className="badge badge-role">{interview.job_role}</span>
              </div>
              <h2 style={{ fontSize: '1.4rem', color: '#0f172a' }}>{interview.title}</h2>
              <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.2rem' }}>
                Scheduled for {new Date(interview.scheduled_time).toLocaleString()}
              </p>
            </div>

            {/* Candidate & Match Score Summary Bar */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1rem 1.25rem',
              marginBottom: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Candidate</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0f172a' }}>{interview.candidate_name || 'Candidate'}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{interview.candidate_email}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Job Description</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>{interview.job_description_title || 'General Role'}</div>
              </div>

              {/* Match Score from Phase 2 */}
              {interview.match_score ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#ffffff', padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Resume Match</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#2563eb' }}>
                      {Math.round(interview.match_score.overall_match_score)}%
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No resume uploaded</div>
              )}
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {successMsg && <div className="alert alert-success">{successMsg}</div>}

            {/* Questions Header & Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>
                  Interview Question Plan ({interview.questions?.length || 0})
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Personalized technical, project, and role-specific questions
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={regenerating}
                  onClick={handleRegenerateQuestions}
                >
                  <span>⚡</span> {regenerating ? 'Regenerating...' : 'Regenerate AI Questions'}
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowAddForm(!showAddForm)}
                >
                  <span>+</span> Add Custom Question
                </button>
              </div>
            </div>

            {/* Add Custom Question Form */}
            {showAddForm && (
              <form onSubmit={handleAddCustomQuestion} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.25rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>Add Custom Question</h4>
                
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label">Question Text</label>
                  <textarea
                    required
                    placeholder="Enter custom interview question..."
                    className="form-textarea"
                    style={{ minHeight: '60px' }}
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                  />
                </div>

                <div className="form-row" style={{ marginBottom: '0.75rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Category</label>
                    <select
                      className="form-select"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                    >
                      <option value="Technical">Technical</option>
                      <option value="Resume/Project">Resume/Project</option>
                      <option value="Role-Specific">Role-Specific</option>
                      <option value="Experience-Based">Experience-Based</option>
                      <option value="Situational">Situational</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Difficulty</label>
                    <select
                      className="form-select"
                      value={newDifficulty}
                      onChange={(e) => setNewDifficulty(e.target.value)}
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowAddForm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={addingQuestion}
                  >
                    {addingQuestion ? 'Adding...' : 'Save Question'}
                  </button>
                </div>
              </form>
            )}

            {/* Questions List */}
            {(!interview.questions || interview.questions.length === 0) ? (
              <div className="empty-state">
                <span style={{ fontSize: '2rem' }}>❓</span>
                <div className="empty-state-title">No questions prepared yet</div>
                <div className="empty-state-desc">Click "Regenerate AI Questions" or "Add Custom Question" above.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {interview.questions.map((q, idx) => (
                  <div key={q.id} className="question-item">
                    {editingQuestionId === q.id ? (
                      /* Inline Edit Form */
                      <form onSubmit={handleSaveEdit}>
                        <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                          <textarea
                            required
                            className="form-textarea"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                          />
                        </div>

                        <div className="form-row" style={{ marginBottom: '0.75rem' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <select
                              className="form-select"
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value)}
                            >
                              <option value="Technical">Technical</option>
                              <option value="Resume/Project">Resume/Project</option>
                              <option value="Role-Specific">Role-Specific</option>
                              <option value="Experience-Based">Experience-Based</option>
                              <option value="Situational">Situational</option>
                            </select>
                          </div>

                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <select
                              className="form-select"
                              value={editDifficulty}
                              onChange={(e) => setEditDifficulty(e.target.value)}
                            >
                              <option value="Easy">Easy</option>
                              <option value="Medium">Medium</option>
                              <option value="Hard">Hard</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setEditingQuestionId(null)}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="btn btn-primary btn-sm"
                            disabled={savingEdit}
                          >
                            {savingEdit ? 'Saving...' : 'Save Changes'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      /* Normal Question Display */
                      <>
                        <div className="question-header">
                          <div className="question-badges">
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>
                              #{idx + 1}
                            </span>
                            <span className="badge badge-cat">
                              {q.category}
                            </span>
                            <span className={`badge ${getDifficultyBadgeClass(q.difficulty)}`}>
                              {q.difficulty}
                            </span>
                            {q.is_custom === 1 && (
                              <span className="badge" style={{ backgroundColor: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe' }}>
                                Custom
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                              onClick={() => handleStartEdit(q)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                              onClick={() => handleDeleteQuestion(q.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        <div style={{ fontSize: '0.9rem', color: '#0f172a', lineHeight: 1.45 }}>
                          {q.question_text}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                Close Preparation
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
