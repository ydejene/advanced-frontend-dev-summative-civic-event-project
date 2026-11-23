/**
 * Announcement Detail Controller
 * Handles loading single announcement details, native audio stream initialization,
 * dynamic audio duration retrieval from element metadata, and admin publishing actions.
 */
import { initShell } from '../components.js';
import { isAuthenticated, isAdmin } from '../auth.js';
import api from '../api.js';
import { formatDate, escapeHtml, showToast } from '../utils.js';

let currentAnnouncement = null;

/**
 * Formats duration in seconds to M:SS.
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  if (isNaN(seconds) || !isFinite(seconds) || seconds <= 0) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Initializes the Announcement Detail page.
 */
function init() {
  initShell('announcements');

  const params = new URLSearchParams(window.location.search);
  const announcementId = params.get('id');

  // Configure guest prompt links
  const guestLoginBtn = document.getElementById('guest-login-btn');
  const guestSignupBtn = document.getElementById('guest-signup-btn');
  const currentPath = encodeURIComponent(window.location.pathname + window.location.search);
  if (guestLoginBtn) guestLoginBtn.href = `/pages/auth/login.html?redirect=${currentPath}`;
  if (guestSignupBtn) guestSignupBtn.href = `/pages/auth/signup.html?redirect=${currentPath}`;

  checkAuthAndLoad(announcementId);

  window.addEventListener('auth-state-changed', () => {
    checkAuthAndLoad(announcementId);
  });
}

/**
 * Evaluates authentication state before requesting protected announcement data.
 * @param {string|null} id
 */
function checkAuthAndLoad(id) {
  const authed = isAuthenticated();
  const guestPrompt = document.getElementById('guest-prompt');
  const loading = document.getElementById('detail-loading');
  const errorEl = document.getElementById('detail-error');
  const content = document.getElementById('announcement-content');

  if (!authed) {
    if (guestPrompt) guestPrompt.classList.remove('hidden');
    if (loading) loading.classList.add('hidden');
    if (errorEl) errorEl.classList.add('hidden');
    if (content) content.classList.add('hidden');
    return;
  }

  if (guestPrompt) guestPrompt.classList.add('hidden');

  if (!id) {
    if (loading) loading.classList.add('hidden');
    if (errorEl) {
      errorEl.classList.remove('hidden');
      const title = document.getElementById('error-title');
      const desc = document.getElementById('error-desc');
      if (title) title.textContent = 'Missing Announcement ID';
      if (desc) desc.textContent = 'No announcement identifier was provided in the URL.';
    }
    return;
  }

  loadAnnouncement(id);
}

/**
 * Fetches announcement record by ID.
 * @param {string} id
 */
function loadAnnouncement(id) {
  const loading = document.getElementById('detail-loading');
  const errorEl = document.getElementById('detail-error');
  const content = document.getElementById('announcement-content');

  loading?.classList.remove('hidden');
  errorEl?.classList.add('hidden');
  content?.classList.add('hidden');

  api.get(`/announcements/${id}`)
    .done((res) => {
      const data = res?.data;
      if (!data) {
        throw new Error('Announcement not found');
      }

      // Draft protection: Ordinary users cannot view unpublished announcements
      if (!data.published && !isAdmin()) {
        loading?.classList.add('hidden');
        if (errorEl) {
          errorEl.classList.remove('hidden');
          const title = document.getElementById('error-title');
          const desc = document.getElementById('error-desc');
          if (title) title.textContent = 'Announcement Not Available';
          if (desc) desc.textContent = 'This announcement is currently unpublished and cannot be accessed.';
        }
        return;
      }

      currentAnnouncement = data;
      renderAnnouncement(data);
    })
    .fail((xhr) => {
      loading?.classList.add('hidden');
      if (xhr.status !== 401) {
        errorEl?.classList.remove('hidden');
        const desc = document.getElementById('error-desc');
        if (desc) {
          desc.textContent = xhr.status === 404
            ? 'The requested announcement bulletin was not found.'
            : (xhr.responseJSON?.message || 'Failed to load announcement details.');
        }
      }
    });
}

/**
 * Renders announcement metadata, player, and administrator controls.
 * @param {Object} item
 */
function renderAnnouncement(item) {
  const loading = document.getElementById('detail-loading');
  const content = document.getElementById('announcement-content');
  const breadcrumb = document.getElementById('breadcrumb-title');
  const titleEl = document.getElementById('announcement-title');
  const dateEl = document.getElementById('announcement-date');
  const durationEl = document.getElementById('announcement-duration');
  const publishedBadge = document.getElementById('published-badge');
  const audioPlayer = document.getElementById('audio-player');
  const audioSource = document.getElementById('audio-source');
  const audioError = document.getElementById('audio-error-msg');
  const adminControls = document.getElementById('admin-controls');
  const adminPublishToggle = document.getElementById('admin-publish-toggle');
  const adminDeleteBtn = document.getElementById('admin-delete-btn');

  loading?.classList.add('hidden');
  content?.classList.remove('hidden');

  // Page title and breadcrumb
  document.title = `${escapeHtml(item.title)} — CivicEvents`;
  if (breadcrumb) breadcrumb.textContent = item.title;
  if (titleEl) titleEl.textContent = item.title;
  if (dateEl) {
    dateEl.textContent = formatDate(item.created_at);
    dateEl.setAttribute('datetime', item.created_at);
  }

  // Publication badge for administrators
  if (isAdmin()) {
    if (publishedBadge) {
      publishedBadge.classList.remove('hidden');
      if (item.published) {
        publishedBadge.className = 'badge bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1 rounded';
        publishedBadge.textContent = 'Published';
      } else {
        publishedBadge.className = 'badge bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded';
        publishedBadge.textContent = 'Draft (Unpublished)';
      }
    }
  }

  // Native Audio player setup
  if (audioSource && audioPlayer) {
    audioSource.src = item.audio_url;
    audioPlayer.load();

    const updateDuration = () => {
      if (audioPlayer.duration && !isNaN(audioPlayer.duration)) {
        if (durationEl) durationEl.textContent = formatDuration(audioPlayer.duration);
      }
    };

    audioPlayer.addEventListener('loadedmetadata', updateDuration, { once: true });

    audioPlayer.addEventListener('error', () => {
      if (audioError) audioError.classList.remove('hidden');
      if (durationEl) durationEl.textContent = 'Playback unavailable';
    });
  }

  // Admin Controls
  if (isAdmin() && adminControls) {
    adminControls.classList.remove('hidden');

    if (adminPublishToggle) {
      adminPublishToggle.textContent = item.published ? 'Unpublish Bulletin' : 'Publish Bulletin';
      adminPublishToggle.onclick = () => togglePublish(item);
    }

    if (adminDeleteBtn) {
      adminDeleteBtn.onclick = () => deleteAnnouncement(item);
    }
  }
}

/**
 * Handles admin publish / unpublish toggle.
 * @param {Object} item
 */
function togglePublish(item) {
  const endpoint = item.published
    ? `/announcements/${item.id}/unpublish`
    : `/announcements/${item.id}/publish`;

  const actionVerb = item.published ? 'unpublishing' : 'publishing';

  api.patch(endpoint, {})
    .done((res) => {
      showToast(`Announcement ${item.published ? 'unpublished' : 'published'} successfully`, 'success');
      // Refresh announcement details
      if (res?.data) {
        currentAnnouncement = res.data;
        renderAnnouncement(res.data);
      } else {
        loadAnnouncement(item.id);
      }
    })
    .fail((xhr) => {
      const msg = xhr.responseJSON?.message || `Error ${actionVerb} announcement`;
      showToast(msg, 'error');
    });
}

/**
 * Handles admin delete announcement action with confirmation.
 * @param {Object} item
 */
function deleteAnnouncement(item) {
  const confirmed = window.confirm(`Are you sure you want to delete the announcement "${item.title}"? This action cannot be undone.`);
  if (!confirmed) return;

  api.delete(`/announcements/${item.id}`)
    .done(() => {
      showToast('Announcement deleted successfully', 'success');
      setTimeout(() => {
        window.location.replace('/pages/announcements/index.html');
      }, 1000);
    })
    .fail((xhr) => {
      const msg = xhr.responseJSON?.message || 'Failed to delete announcement';
      showToast(msg, 'error');
    });
}

// Bootstrap once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

