/**
 * Promotion Detail Controller
 * Handles loading single promo details, native video player configuration,
 * accessible caption/transcript presentation, and admin publishing actions.
 */
import { initShell } from '../components.js';
import { isAuthenticated, isAdmin } from '../auth.js';
import api from '../api.js';
import { formatDate, escapeHtml, showToast } from '../utils.js';

let currentPromo = null;

/**
 * Initializes the Promotion Detail page.
 */
function init() {
  initShell('promotions');

  const params = new URLSearchParams(window.location.search);
  const promoId = params.get('id');

  // Configure guest prompt links
  const guestLoginBtn = document.getElementById('guest-login-btn');
  const guestSignupBtn = document.getElementById('guest-signup-btn');
  const currentPath = encodeURIComponent(window.location.pathname + window.location.search);
  if (guestLoginBtn) guestLoginBtn.href = `/pages/auth/login.html?redirect=${currentPath}`;
  if (guestSignupBtn) guestSignupBtn.href = `/pages/auth/signup.html?redirect=${currentPath}`;

  checkAuthAndLoad(promoId);

  window.addEventListener('auth-state-changed', () => {
    checkAuthAndLoad(promoId);
  });
}

/**
 * Evaluates authentication state before requesting protected promo data.
 * @param {string|null} id
 */
function checkAuthAndLoad(id) {
  const authed = isAuthenticated();
  const guestPrompt = document.getElementById('guest-prompt');
  const loading = document.getElementById('detail-loading');
  const errorEl = document.getElementById('detail-error');
  const content = document.getElementById('promo-content');

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
      if (title) title.textContent = 'Missing Promotion ID';
      if (desc) desc.textContent = 'No promotion identifier was provided in the URL.';
    }
    return;
  }

  loadPromo(id);
}

/**
 * Fetches promo record by ID.
 * @param {string} id
 */
function loadPromo(id) {
  const loading = document.getElementById('detail-loading');
  const errorEl = document.getElementById('detail-error');
  const content = document.getElementById('promo-content');

  loading?.classList.remove('hidden');
  errorEl?.classList.add('hidden');
  content?.classList.add('hidden');

  api.get(`/promos/${id}`)
    .done((res) => {
      const data = res?.data;
      if (!data) {
        throw new Error('Promotion not found');
      }

      // Draft protection: Ordinary users cannot view unpublished promotions
      if (!data.published && !isAdmin()) {
        loading?.classList.add('hidden');
        if (errorEl) {
          errorEl.classList.remove('hidden');
          const title = document.getElementById('error-title');
          const desc = document.getElementById('error-desc');
          if (title) title.textContent = 'Promotion Not Available';
          if (desc) desc.textContent = 'This video promotion is currently unpublished and cannot be accessed.';
        }
        return;
      }

      currentPromo = data;
      renderPromo(data);
    })
    .fail((xhr) => {
      loading?.classList.add('hidden');
      if (xhr.status !== 401) {
        errorEl?.classList.remove('hidden');
        const desc = document.getElementById('error-desc');
        if (desc) {
          desc.textContent = xhr.status === 404
            ? 'The requested video campaign was not found.'
            : (xhr.responseJSON?.message || 'Failed to load promotion details.');
        }
      }
    });
}

/**
 * Renders promotion metadata, video player, caption text, and administrator controls.
 * @param {Object} item
 */
function renderPromo(item) {
  const loading = document.getElementById('detail-loading');
  const content = document.getElementById('promo-content');
  const breadcrumb = document.getElementById('breadcrumb-title');
  const titleEl = document.getElementById('promo-title');
  const dateEl = document.getElementById('promo-date');
  const publishedBadge = document.getElementById('published-badge');
  const videoPlayer = document.getElementById('promo-video');
  const videoSource = document.getElementById('video-source');
  const videoError = document.getElementById('video-error-msg');
  const descEl = document.getElementById('promo-description');
  const captionsText = document.getElementById('promo-captions-text');
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

  // Native Video player setup
  if (videoSource && videoPlayer) {
    videoSource.src = item.video_url;
    videoPlayer.load();

    videoPlayer.addEventListener('error', () => {
      if (videoError) videoError.classList.remove('hidden');
    });
  }

  // Description
  if (descEl) {
    descEl.textContent = item.description || 'No description provided.';
  }

  // Captions / Transcript presentation
  if (captionsText) {
    if (item.caption_text && item.caption_text.trim()) {
      captionsText.textContent = item.caption_text;
      captionsText.className = 'whitespace-pre-line text-gray-800';
    } else {
      captionsText.textContent = 'No written captions or transcript were provided with this promotional video.';
      captionsText.className = 'italic text-gray-500';
    }
  }

  // Admin Controls
  if (isAdmin() && adminControls) {
    adminControls.classList.remove('hidden');

    if (adminPublishToggle) {
      adminPublishToggle.textContent = item.published ? 'Unpublish Promotion' : 'Publish Promotion';
      adminPublishToggle.onclick = () => togglePublish(item);
    }

    if (adminDeleteBtn) {
      adminDeleteBtn.onclick = () => deletePromo(item);
    }
  }
}

/**
 * Handles admin publish / unpublish toggle.
 * @param {Object} item
 */
function togglePublish(item) {
  const endpoint = item.published
    ? `/promos/${item.id}/unpublish`
    : `/promos/${item.id}/publish`;

  const actionVerb = item.published ? 'unpublishing' : 'publishing';

  api.patch(endpoint, {})
    .done((res) => {
      showToast(`Promotion ${item.published ? 'unpublished' : 'published'} successfully`, 'success');
      if (res?.data) {
        currentPromo = res.data;
        renderPromo(res.data);
      } else {
        loadPromo(item.id);
      }
    })
    .fail((xhr) => {
      const msg = xhr.responseJSON?.message || `Error ${actionVerb} promotion`;
      showToast(msg, 'error');
    });
}

/**
 * Handles admin delete promo action with confirmation.
 * @param {Object} item
 */
function deletePromo(item) {
  const confirmed = window.confirm(`Are you sure you want to delete the promotion "${item.title}"? This action cannot be undone.`);
  if (!confirmed) return;

  api.delete(`/promos/${item.id}`)
    .done(() => {
      showToast('Promotion deleted successfully', 'success');
      setTimeout(() => {
        window.location.replace('/pages/promotions/index.html');
      }, 1000);
    })
    .fail((xhr) => {
      const msg = xhr.responseJSON?.message || 'Failed to delete promotion';
      showToast(msg, 'error');
    });
}

// Bootstrap once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

