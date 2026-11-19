/**
 * Shared utility helpers.
 */

/**
 * Returns the stored JWT token, or null if absent.
 * @returns {string|null}
 */
export function getToken() {
  return sessionStorage.getItem('ce_token');
}

/**
 * Returns the stored user object, or null if absent.
 * @returns {Object|null}
 */
export function getUser() {
  const raw = sessionStorage.getItem('ce_user');
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

/**
 * Returns true when a valid session token exists.
 * @returns {boolean}
 */
export function isAuthenticated() {
  return Boolean(getToken());
}

/**
 * Returns true when the stored user has the 'admin' role.
 * @returns {boolean}
 */
export function isAdmin() {
  return getUser()?.role === 'admin';
}

/**
 * Formats an ISO date string to a locale-friendly display value.
 * @param {string} isoString
 * @returns {string}
 */
export function formatDate(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

/**
 * Formats an ISO date string to include time.
 * @param {string} isoString
 * @returns {string}
 */
export function formatDateTime(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Escapes HTML special characters to prevent injection.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Truncates a string to the specified character limit, appending an ellipsis.
 * @param {string} str
 * @param {number} limit
 * @returns {string}
 */
export function truncate(str, limit = 120) {
  if (!str || str.length <= limit) return str ?? '';
  return str.slice(0, limit).trimEnd() + '…';
}

/**
 * Returns a relative time string (e.g. "3 hours ago").
 * @param {string} isoString
 * @returns {string}
 */
export function timeAgo(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1)  return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

