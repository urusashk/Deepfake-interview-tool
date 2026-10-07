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

  // Interviewer
  getCandidates: () => apiRequest('/interviewer/candidates'),
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
};
