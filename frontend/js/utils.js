/**
 * Shared utility helpers.
 *
 * Auth session helpers are sourced from ./auth.js and re-exported here
 * to maintain backward compatibility across existing imports.
 */
export { getToken, getUser, isAuthenticated, isAdmin } from './auth.js';

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
 * Escapes HTML special characters to prevent XSS injection.
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

/**
 * Displays a lightweight toast notification on the page.
 * @param {string} message - Notification text
 * @param {'info'|'success'|'error'} [type='info'] - Severity variant
 * @param {number} [durationMs=4000] - Display duration before auto-removal
 */
export function showToast(message, type = 'info', durationMs = 4000) {
  const toast = document.createElement('div');
  const typeClass = type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : 'toast-info';
  toast.className = `${typeClass} transition-opacity duration-300`;
  toast.setAttribute('role', 'alert');
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, durationMs);
}

/**
 * Resolves event category and image with approved category fallback photography.
 * @param {Object} event - Event record from backend.
 * @returns {{ category: string, image: string, fallbackImage: string }}
 */
export function getCategoryInfo(event) {
  let cat = event?.metadata?.category;
  if (!cat && typeof event?.metadata === 'string') {
    try {
      const parsed = JSON.parse(event.metadata);
      cat = parsed.category;
    } catch {
      // Ignore parse error
    }
  }

  if (!cat) {
    const text = `${event?.title || ''} ${event?.description || ''}`.toLowerCase();
    if (text.includes('clean-up') || text.includes('environment') || text.includes('park') || text.includes('recycle') || text.includes('green')) {
      cat = 'Environment';
    } else if (text.includes('culture') || text.includes('cultural') || text.includes('festival') || text.includes('music') || text.includes('heritage')) {
      cat = 'Cultural';
    } else if (text.includes('workshop') || text.includes('skills') || text.includes('training') || text.includes('class') || text.includes('learn')) {
      cat = 'Workshop';
    } else if (text.includes('sport') || text.includes('sports') || text.includes('marathon') || text.includes('tournament') || text.includes('fitness')) {
      cat = 'Sports';
    } else if (text.includes('volunteer') || text.includes('volunteering') || text.includes('social') || text.includes('charity')) {
      cat = 'Volunteering';
    } else {
      cat = 'Community';
    }
  }

  // Normalize category casing (e.g. "community" -> "Community")
  cat = cat.trim();
  cat = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();

  const fallbackImages = {
    'Community': '/assets/images/event-community.jpg',
    'Cultural': '/assets/images/event-cultural-festival.jpg',
    'Workshop': '/assets/images/event-workshop.jpg',
    'Sports': '/assets/images/event-sports.jpg',
    'Environment': '/assets/images/event-environment.png',
    'Volunteering': '/assets/images/event-volunteering.jpg',
  };

  const fallback = fallbackImages[cat] || fallbackImages['Community'];
  const image = event?.metadata?.image_url || fallback;

  return {
    category: cat,
    image,
    fallbackImage: fallback,
  };
}
