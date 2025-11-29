const rawBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  import.meta.env.VITE_BACKEND_URL?.trim() ||
  import.meta.env.VITE_API_URL?.trim();

if (!rawBaseUrl) {
  throw new Error(
    'Missing backend URL. Set VITE_API_BASE_URL (or VITE_BACKEND_URL) in .env/.env.local so builds pick it up.',
  );
}

const normalizedBaseUrl = rawBaseUrl.replace(/\/$/, '');

export const API_BASE_URL = normalizedBaseUrl;

export const API_ENDPOINTS = {
  session: `${API_BASE_URL}/auth/me`,
  googleLogin: `${API_BASE_URL}/auth/login`,
  logout: `${API_BASE_URL}/auth/logout`,
  completeRegistration: `${API_BASE_URL}/users/me/onboarding`,
  updateProfile: `${API_BASE_URL}/users/me/profile`,
  updateMedical: `${API_BASE_URL}/users/me/medical`,
  responders: `${API_BASE_URL}/api/responders`,
  chatGroups: `${API_BASE_URL}/api/chat/groups`,
} as const;
