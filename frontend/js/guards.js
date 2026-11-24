/**
 * Frontend Route & Role-Based Access Guard Module
 *
 * Architecture & Access Control Overview:
 * 1. Authentication Checking:
 *    - Validates presence of active JWT session credentials via isAuthenticated() in auth.js.
 *    - If unauthenticated, access is blocked and the visitor is redirected to /pages/auth/login.html
 *      with the return path encoded in the URL query string.
 *
 * 2. Role-Based Access Enforcement:
 *    - Differentiates between ordinary community residents (role: 'user') and municipal staff (role: 'admin').
 *    - requireAdmin() enforces both an active session AND role === 'admin'.
 *    - Ordinary authenticated users attempting to access administrator consoles (/pages/admin/*)
 *      are prevented from viewing the interface and redirected to /index.html?error=forbidden.
 *
 * 3. Visitor / Guest Gating:
 *    - requireGuest() prevents logged-in users from accessing login and registration entry pages,
 *      routing administrators to /pages/admin/dashboard.html and residents to /index.html.
 *
 * 4. Content Concealment:
 *    - concealPageContent() hides DOM elements during evaluation to prevent flash of unauthorized
 *      content (FOUC) prior to redirect execution.
 *
 * 5. Defense-in-Depth & Backend Authorization Authority:
 *    - IMPORTANT SECURITY NOTE: Frontend guards govern client-side UI visibility and navigation flow.
 *    - They DO NOT replace backend security. The Node.js/Express API remains the sole authority,
 *      authenticating every request via JWT verification (authenticate middleware) and enforcing
 *      privilege checks via role middleware (authorize(['admin'])). Any direct API request by an
 *      ordinary user to an administrative endpoint returns HTTP 403 Forbidden regardless of frontend state.
 */
import { isAuthenticated, isAdmin, clearSession } from './auth.js';

/**
 * Route Guard: Requires an active authenticated session.
 * Used across member-only resident pages (/pages/user/*, /pages/notifications/*).
 *
 * When options.adminOnly is true, enforces administrative privileges (role === 'admin').
 * If an ordinary authenticated user (role: 'user') attempts access, they are redirected
 * to /index.html?error=forbidden.
 *
 * Usage in page scripts:
 *   import { requireAuth } from '../guards.js';
 *   if (!requireAuth()) return;
 *
 * @param {Object} [options]
 * @param {boolean} [options.adminOnly=false] - When true, restricts access strictly to role === 'admin'
 * @param {string}  [options.redirectUrl]     - Optional override destination for unauthenticated visitors
 * @returns {boolean} True if the visitor satisfies the access requirements, false otherwise.
 */
export function requireAuth(options = {}) {
  const { adminOnly = false, redirectUrl } = options;

  if (!isAuthenticated()) {
    concealPageContent();

    if (typeof window !== 'undefined') {
      const currentPath = encodeURIComponent(window.location.pathname + window.location.search);
      const loginTarget = redirectUrl || `/pages/auth/login.html?unauthorized=true&redirect=${currentPath}`;
      window.location.replace(loginTarget);
    }
    return false;
  }

  /*
   * Role-based guard check:
   * Compares the stored session user's role against the required 'admin' privilege.
   * If an authenticated non-admin accesses an admin page, redirect to home with a forbidden indicator.
   */
  if (adminOnly && !isAdmin()) {
    concealPageContent();
    if (typeof window !== 'undefined') {
      window.location.replace('/index.html?error=forbidden');
    }
    return false;
  }

  revealPageContent();
  return true;
}

/**
 * Role-Based Route Guard: Admin-Only Console Protection.
 * Restricts administrative management views (/pages/admin/*) strictly to accounts with role === 'admin'.
 *
 * Protection mechanism:
 * - Unauthenticated visitors -> redirected to login page with return redirect.
 * - Authenticated normal users -> redirected to home page with ?error=forbidden indicator.
 * - Authenticated administrators -> page content is revealed and script execution proceeds.
 *
 * @returns {boolean} True if user is authenticated with admin privileges.
 */
export function requireAdmin() {
  return requireAuth({ adminOnly: true });
}

/**
 * Route Guard: For guest-only pages (login, signup).
 * If the visitor already has an active session, redirects them to their relevant dashboard/home.
 * @param {Object} [options]
 * @param {string} [options.redirectUrl] - Destination for normal users (defaults to /index.html)
 * @returns {boolean} True if visitor is a guest, false if redirecting away.
 */
export function requireGuest(options = {}) {
  if (isAuthenticated()) {
    concealPageContent();
    if (typeof window !== 'undefined') {
      if (isAdmin()) {
        window.location.replace('/pages/admin/dashboard.html');
      } else {
        window.location.replace(options.redirectUrl || '/index.html');
      }
    }
    return false;
  }
  return true;
}

/**
 * Hides main page content or body during authorization evaluation.
 */
function concealPageContent() {
  if (typeof document === 'undefined') return;
  const main = document.getElementById('main-content');
  if (main) {
    main.style.visibility = 'hidden';
  } else if (document.body) {
    document.body.style.display = 'none';
  }
}

/**
 * Restores page visibility after authorization checks pass.
 */
function revealPageContent() {
  if (typeof document === 'undefined') return;
  const main = document.getElementById('main-content');
  if (main) {
    main.style.visibility = 'visible';
  } else if (document.body) {
    document.body.style.display = '';
  }
}

/*
 * Cross-tab and session lifecycle listeners:
 * Listens for session expiry events (401) and cross-tab auth state changes (storage events).
 */
if (typeof window !== 'undefined') {
  // Global listener for session expiry events triggered by the API client
  window.addEventListener('session-expired', () => {
    clearSession();
    const currentPath = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`/pages/auth/login.html?expired=true&redirect=${currentPath}`);
  });

  // Cross-tab synchronization listener
  window.addEventListener('auth-state-changed', (e) => {
    const isAuthed = e.detail?.authenticated ?? isAuthenticated();
    const path = window.location.pathname;

    // If session was terminated in another tab and this page requires authentication, redirect to login
    const isProtectedPage = path.includes('/pages/user/') || path.includes('/pages/admin/');
    if (!isAuthed && isProtectedPage) {
      const currentPath = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/pages/auth/login.html?expired=true&redirect=${currentPath}`);
      return;
    }

    // If session was established in another tab and this page is guest-only, redirect away
    const isGuestOnlyPage = path.includes('/pages/auth/login.html') || path.includes('/pages/auth/signup.html');
    if (isAuthed && isGuestOnlyPage) {
      if (isAdmin()) {
        window.location.replace('/pages/admin/dashboard.html');
      } else {
        window.location.replace('/index.html');
      }
    }
  });
}
