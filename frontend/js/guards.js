/**
 * Frontend route and access guard module.
 *
 * Responsibilities:
 *   - Prevent unauthenticated users from viewing protected user or admin pages.
 *   - Role-based guard: Restrict administrative views to accounts with role 'admin'.
 *   - Prevent authenticated users from accessing visitor-only pages (e.g. login, signup).
 *   - Prevent flash of unauthorized content before route checks complete.
 *   - Cross-tab synchronization: Automatically update/redirect pages when session
 *     state changes in another open browser tab.
 *
 * IMPORTANT SECURITY NOTE:
 * Frontend guards are a usability and workflow measure to guide visitors.
 * They do NOT replace backend authorization. The backend API enforces true
 * security via authentication and authorization middleware on all protected routes.
 */
import { isAuthenticated, isAdmin, clearSession } from './auth.js';

/**
 * Route Guard: Requires an active authenticated session.
 * Optionally restricts the view to administrators.
 *
 * Usage in page scripts:
 *   import { requireAuth } from '../guards.js';
 *   if (!requireAuth()) return;
 *
 * @param {Object} [options]
 * @param {boolean} [options.adminOnly=false] - When true, enforces role === 'admin'
 * @param {string}  [options.redirectUrl]     - Custom redirect destination for unauthenticated visitors
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
 * Convenience wrapper for admin-only pages.
 * Enforces authenticated session AND role === 'admin'.
 * @returns {boolean}
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
