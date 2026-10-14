const API_BASE_URL = 'http://127.0.0.1:8000/api';

export const getAuthToken = () => localStorage.getItem('access_token');
export const getUserInfo = () => {
  const user = localStorage.getItem('user_info');
  return user ? JSON.parse(user) : null;
};

export const setSession = (token, user) => {
  localStorage.setItem('access_token', token);
  localStorage.setItem('user_info', JSON.stringify(user));
};

export const clearSession = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user_info');
};

async function apiRequest(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    ...options.headers,
  };

  // Add auth header if token exists and not already set
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Set default JSON Content-Type unless payload is FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.detail || 'An error occurred. Please try again.';
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Auth
  register: (payload) => apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  login: (payload) => apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  getMe: () => apiRequest('/auth/me'),

  // Candidate
  getCandidateProfile: () => apiRequest('/candidate/profile'),
  updateCandidateProfile: (payload) => apiRequest('/candidate/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),
  uploadResume: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest('/candidate/resume/upload', {
      method: 'POST',
      body: formData,
    });
  },
  getCandidateInterviews: () => apiRequest('/candidate/interviews'),
  generateMockInterview: (payload) => apiRequest('/candidate/mock-interview/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  evaluateMockAnswer: (payload) => apiRequest('/candidate/mock-interview/evaluate-answer', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  // Notifications (Candidate)
  getNotifications: () => apiRequest('/candidate/notifications'),
  markNotificationsRead: (notificationIds = null) => apiRequest('/candidate/notifications/read', {
    method: 'POST',
    body: JSON.stringify({ notification_ids: notificationIds }),
  }),

  // Interviewer
  getCandidates: (jobDescriptionId) => {
    const query = jobDescriptionId ? `?job_description_id=${jobDescriptionId}` : '';
    return apiRequest(`/interviewer/candidates${query}`);
  },
  getCandidateDetail: (candidateId) => apiRequest(`/interviewer/candidates/${candidateId}`),
  getJobDescriptions: () => apiRequest('/interviewer/job-descriptions'),
  createJobDescription: (payload) => apiRequest('/interviewer/job-descriptions', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  createInterview: (payload) => apiRequest('/interviewer/interviews', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  getInterviewerInterviews: () => apiRequest('/interviewer/interviews'),
  getInterviewDetail: (interviewId) => apiRequest(`/interviews/${interviewId}`),

  // Phase 3 Question Management
  regenerateQuestions: (interviewId) => apiRequest(`/interviews/${interviewId}/questions/generate`, {
    method: 'POST',
  }),
  addCustomQuestion: (interviewId, payload) => apiRequest(`/interviews/${interviewId}/questions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  updateQuestion: (questionId, payload) => apiRequest(`/interviews/questions/${questionId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),
  deleteQuestion: (questionId) => apiRequest(`/interviews/questions/${questionId}`, {
    method: 'DELETE',
  }),
  getFollowUpQuestions: (interviewId, payload) => apiRequest(`/interviews/${interviewId}/follow-up-questions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  // Phase 4 Live Room & Recording
  updateInterviewSession: (interviewId, payload) => apiRequest(`/interviews/${interviewId}/session`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),
  setRecordingConsent: (interviewId, consent) => apiRequest(`/interviews/${interviewId}/recording/consent`, {
    method: 'POST',
    body: JSON.stringify({ consent }),
  }),
  uploadRecording: (interviewId, blob, filename = 'recording.webm') => {
    const formData = new FormData();
    formData.append('file', blob, filename);
    return apiRequest(`/interviews/${interviewId}/recording`, {
      method: 'POST',
      body: formData,
    });
  },
  getRecordingUrl: (interviewId) => `${API_BASE_URL}/interviews/${interviewId}/recording`,

  // Phase 5 Speech-to-Text & AI Analysis
  getInterviewAnalysis: (interviewId) => apiRequest(`/interviews/${interviewId}/analysis`),
  triggerInterviewAnalysis: (interviewId) => apiRequest(`/interviews/${interviewId}/analysis`, {
    method: 'POST',
  }),
  getSampleTranscript: (interviewId) => apiRequest(`/interviews/${interviewId}/sample-transcript`),
  loadTranscriptAndAnalyze: (interviewId, payload) => apiRequest(`/interviews/${interviewId}/load-transcript`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  uploadInterviewAudio: (interviewId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest(`/interviews/${interviewId}/upload-audio`, {
      method: 'POST',
      body: formData,
    });
  },
};



