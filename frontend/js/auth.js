/**
 * Authentication and session management module.
 *
 * Manages JWT session tokens and user state in localStorage.
 * Using localStorage enables cross-tab session synchronization so that
 * logging in or out in one tab immediately updates all open tabs on the same origin.
 *
 * Storage keys:
 *   - ce_token: Raw JWT string for Bearer authentication
 *   - ce_user:  JSON string of the authenticated user profile
 *
 * Note: Browser storage is client-side state for UX and navigation.
 * The backend remains the sole authority on token validity and authorization.
 */
import api from './api.js';

export const STORAGE_KEYS = {
  TOKEN: 'ce_token',
  USER:  'ce_user',
};

/**
 * Returns the active JWT string from localStorage, or null if absent.
 * @returns {string|null}
 */
export function getToken() {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.TOKEN);
}

/**
 * Returns the parsed user profile object from localStorage, or null if absent.
 * @returns {{ id: string, full_name: string, email: string, role: string }|null}
 */
export function getUser() {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEYS.USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Returns true if an authentication token exists in localStorage.
 * @returns {boolean}
 */
export function isAuthenticated() {
  return Boolean(getToken());
}

/**
 * Role-based check: Returns true if the stored session user has role 'admin'.
 * Used for client-side navigation and route guard gating.
 * @returns {boolean}
 */
export function isAdmin() {
  const user = getUser();
  return Boolean(user && user.role === 'admin');
}

/**
 * Dispatches a local custom event so page components in the current tab
 * can react to authentication state changes immediately.
 */
function notifyAuthStateChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth-state-changed', {
      detail: { authenticated: isAuthenticated(), user: getUser() }
    }));
  }
}

/**
 * Persists session credentials to localStorage and notifies local components.
 * @param {string} token - JWT token from POST /api/auth/login
 * @param {Object} user  - User profile object ({ id, full_name, email, role })
 */
export function setSession(token, user) {
  if (typeof localStorage === 'undefined') return;
  if (token) {
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
  }
  if (user) {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  }
  notifyAuthStateChanged();
}

/**
 * Removes session credentials from localStorage and clears any legacy session items.
 */
export function clearSession() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(STORAGE_KEYS.TOKEN);
    sessionStorage.removeItem(STORAGE_KEYS.USER);
  }
  notifyAuthStateChanged();
}

/**
 * Submits credentials to POST /api/auth/login.
 * On success (200), stores the JWT and user profile in localStorage.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ user: Object, token: string }>}
 */
export async function login(email, password) {
  try {
    const res = await api.public.post('/auth/login', {
      email: email.trim().toLowerCase(),
      password,
    });

    if (res?.data?.token && res?.data?.user) {
      setSession(res.data.token, res.data.user);
      return { user: res.data.user, token: res.data.token };
    }

    throw new Error(res?.message || 'Login failed. Please check your credentials.');
  } catch (err) {
    if (err?.status === 401) {
      throw new Error('Invalid email or password. Please verify your credentials.');
    }
    const message = extractErrorMessage(err, 'Login failed. Please verify your credentials.');
    throw new Error(message);
  }
}

/**
 * Submits registration to POST /api/auth/signup.
 *
 * Security constraint: The role property is intentionally omitted from the payload.
 * All registrations default to standard 'user' accounts server-side.
 *
 * @param {Object} data
 * @param {string} data.full_name
 * @param {string} data.email
 * @param {string} data.password
 * @returns {Promise<Object>} Created user record
 */
export async function signup({ full_name, email, password }) {
  try {
    const res = await api.public.post('/auth/signup', {
      full_name: full_name.trim(),
      email: email.trim().toLowerCase(),
      password,
    });

    return res?.data;
  } catch (err) {
    if (err?.status === 409) {
      throw new Error('An account with this email address already exists. Please log in instead.');
    }
    const message = extractErrorMessage(err, 'Registration failed. Please check your information.');
    throw new Error(message);
  }
}

/**
 * Terminates the session by clearing stored credentials and redirecting.
 * @param {string} [redirectUrl='/pages/auth/login.html']
 */
export function logout(redirectUrl = '/pages/auth/login.html') {
  clearSession();
  if (typeof window !== 'undefined') {
    window.location.href = redirectUrl;
  }
}

/**
 * Fetches the latest profile data from GET /api/users/profile/me.
 * Synchronizes localStorage with current server record.
 * @returns {Promise<Object|null>}
 */
export async function fetchCurrentUser() {
  try {
    const res = await api.get('/users/profile/me');
    if (res?.data) {
      setSession(getToken(), res.data);
      return res.data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Safely extracts user-facing error text from jQuery AJAX failure objects.
 * Prioritizes granular field validation messages returned by express-validator.
 *
 * @param {Object} err - jQuery XHR error object
 * @param {string} fallback - Fallback user-friendly message
 * @returns {string}
 */
export function extractErrorMessage(err, fallback) {
  // If express-validator returned an array of field errors, extract messages
  if (err?.responseJSON?.errors && Array.isArray(err.responseJSON.errors) && err.responseJSON.errors.length > 0) {
    return err.responseJSON.errors.map(e => e.message || e.msg).join('. ');
  }
  // If specific message is provided and not generic 'Validation failed'
  if (err?.responseJSON?.message && err.responseJSON.message !== 'Validation failed') {
    return err.responseJSON.message;
  }
  if (err?.responseJSON?.message) {
    return err.responseJSON.message;
  }
  if (err?.statusText === 'timeout') {
    return 'The server took too long to respond. Please try again.';
  }
  if (err?.status === 0) {
    return 'Network connection error. Please ensure the backend is running.';
  }
  return fallback;
}

/*
 * Cross-tab synchronization via standard browser 'storage' event:
 * When login or logout occurs in Tab A, the browser fires 'storage' in all other tabs.
 * This triggers 'auth-state-changed' across tabs so the active interface reflects
 * the new session state without requiring a full manual refresh.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEYS.TOKEN || event.key === STORAGE_KEYS.USER || event.key === null) {
      notifyAuthStateChanged();
    }
  });
}
