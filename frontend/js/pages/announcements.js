/**
 * Announcements Listing Controller
 * Manages public announcement discovery, native audio playback previews,
 * metadata-driven duration display, client-side search/sorting, and auth-aware guest prompts.
 */
import { initShell } from '../components.js';
import { isAuthenticated, isAdmin } from '../auth.js';
import api from '../api.js';
import { formatDate, escapeHtml } from '../utils.js';

let allAnnouncements = [];

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
 * Initializes the Announcements page.
 */
function init() {
  initShell('announcements');

  checkAuthAndLoad();

  // Listen for cross-tab or in-page session state modifications
  window.addEventListener('auth-state-changed', () => {
    checkAuthAndLoad();
  });

  bindEvents();
}

/**
 * Verifies authentication state and toggles guest prompt vs authenticated feed.
 */
function checkAuthAndLoad() {
  const authed = isAuthenticated();
  const guestPrompt = document.getElementById('guest-prompt');
  const authContent = document.getElementById('authenticated-content');
  const adminActions = document.getElementById('admin-actions-container');

  if (!authed) {
    if (guestPrompt) guestPrompt.classList.remove('hidden');
    if (authContent) authContent.classList.add('hidden');
    if (adminActions) adminActions.classList.add('hidden');
    return;
  }

  if (guestPrompt) guestPrompt.classList.add('hidden');
  if (authContent) authContent.classList.remove('hidden');

  if (adminActions) {
    if (isAdmin()) {
      adminActions.classList.remove('hidden');
    } else {
      adminActions.classList.add('hidden');
    }
  }

  loadAnnouncements();
}

/**
 * Fetches announcements from backend API.
 */
function loadAnnouncements() {
  const loading = document.getElementById('announcements-loading');
  const errorEl = document.getElementById('announcements-error');
  const emptyEl = document.getElementById('announcements-empty');
  const gridEl = document.getElementById('announcements-grid');

  loading?.classList.remove('hidden');
  errorEl?.classList.add('hidden');
  emptyEl?.classList.add('hidden');
  gridEl?.classList.add('hidden');

  api.get('/announcements')
    .done((res) => {
      // Backend returns { status: 200, data: [...] }
      const items = Array.isArray(res?.data) ? res.data : [];
      allAnnouncements = items;
      renderAnnouncements();
    })
    .fail((xhr) => {
      loading?.classList.add('hidden');
      if (xhr.status !== 401) { // 401 triggers session-expired via api.js
        errorEl?.classList.remove('hidden');
        const msg = xhr.responseJSON?.message || 'Unable to load announcements. Please try again.';
        const errDesc = document.getElementById('error-message');
        if (errDesc) errDesc.textContent = msg;
      }
    });
}

/**
 * Filters, sorts, and renders announcement cards.
 */
function renderAnnouncements() {
  const loading = document.getElementById('announcements-loading');
  const emptyEl = document.getElementById('announcements-empty');
  const gridEl = document.getElementById('announcements-grid');
  const emptyResetBtn = document.getElementById('empty-reset-btn');
  const emptyTitle = document.getElementById('empty-title');
  const emptyDesc = document.getElementById('empty-desc');

  loading?.classList.add('hidden');

  const searchTerm = (document.getElementById('announcement-search')?.value || '').trim().toLowerCase();
  const sortOrder = document.getElementById('announcement-sort')?.value || 'newest';
  const admin = isAdmin();

  // Non-admins see only published announcements. Admins see all announcements.
  let filtered = allAnnouncements.filter((item) => {
    if (!admin && !item.published) return false;
    if (searchTerm) {
      return (item.title || '').toLowerCase().includes(searchTerm);
    }
    return true;
  });

  // Sort announcements
  filtered.sort((a, b) => {
    if (sortOrder === 'oldest') {
      return new Date(a.created_at) - new Date(b.created_at);
    } else if (sortOrder === 'title') {
      return (a.title || '').localeCompare(b.title || '');
    }
    // Default: newest
    return new Date(b.created_at) - new Date(a.created_at);
  });

  if (filtered.length === 0) {
    gridEl?.classList.add('hidden');
    emptyEl?.classList.remove('hidden');

    if (searchTerm) {
      if (emptyTitle) emptyTitle.textContent = 'No Announcements Match Your Search';
      if (emptyDesc) emptyDesc.textContent = `No bulletins found matching "${searchTerm}". Try a different keyword.`;
      if (emptyResetBtn) emptyResetBtn.classList.remove('hidden');
    } else {
      if (emptyTitle) emptyTitle.textContent = 'No Announcements Published';
      if (emptyDesc) emptyDesc.textContent = 'There are currently no audio announcements available. Please check back later for official city bulletins.';
      if (emptyResetBtn) emptyResetBtn.classList.add('hidden');
    }
    return;
  }

  emptyEl?.classList.add('hidden');
  gridEl?.classList.remove('hidden');

  gridEl.innerHTML = filtered.map((announcement) => {
    const publishedBadge = admin
      ? (announcement.published
          ? '<span class="badge bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5 rounded">Published</span>'
          : '<span class="badge bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded">Draft</span>')
      : '';

    return `
      <article class="card p-6 border border-gray-200 transition-shadow hover:shadow-md" data-announcement-id="${announcement.id}">
        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1.5 flex-wrap">
              <span class="inline-flex items-center gap-1 text-xs font-medium text-teal font-heading">
                <svg class="w-4 h-4 text-teal" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z"/>
                </svg>
                Audio Broadcast
              </span>
              ${publishedBadge}
              <span class="text-xs text-gray-500">&bull;</span>
              <time class="text-xs text-gray-500" datetime="${announcement.created_at}">${formatDate(announcement.created_at)}</time>
            </div>
            <h2 class="text-xl font-heading font-bold text-deep-teal tracking-tight">
              <a href="/pages/announcements/detail.html?id=${announcement.id}" class="hover:text-teal focus-visible:outline-2 focus-visible:outline-teal rounded">
                ${escapeHtml(announcement.title)}
              </a>
            </h2>
          </div>
          <div class="flex items-center gap-2">
            <span class="badge bg-gray-100 text-gray-700 text-xs font-mono font-medium px-2.5 py-1 rounded-full audio-duration-badge" id="duration-${announcement.id}">
              Duration: --:--
            </span>
          </div>
        </div>

        <!-- Native Accessible Audio Player -->
        <div class="bg-gray-50 rounded-lg p-3 border border-gray-200 mt-2">
          <audio controls preload="metadata" class="w-full h-10 native-audio-element" data-id="${announcement.id}">
            <source src="${escapeHtml(announcement.audio_url)}" type="audio/mpeg">
            Your browser does not support the audio element.
          </audio>
        </div>

        <div class="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
          <span class="text-gray-500 italic">Official Municipal Voice Broadcast</span>
          <a href="/pages/announcements/detail.html?id=${announcement.id}"
             class="font-semibold text-teal hover:text-deep-teal inline-flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-teal rounded">
            Listen &amp; Details &rarr;
          </a>
        </div>
      </article>
    `;
  }).join('');

  // Attach metadata loaded listeners to update dynamic audio durations
  const audios = gridEl.querySelectorAll('.native-audio-element');
  audios.forEach((audio) => {
    const id = audio.getAttribute('data-id');
    const badge = document.getElementById(`duration-${id}`);

    const updateDuration = () => {
      if (badge && audio.duration && !isNaN(audio.duration)) {
        badge.textContent = `Duration: ${formatDuration(audio.duration)}`;
      }
    };

    if (audio.readyState >= 1) {
      updateDuration();
    } else {
      audio.addEventListener('loadedmetadata', updateDuration, { once: true });
    }

    audio.addEventListener('error', () => {
      if (badge) {
        badge.textContent = 'Audio unavailable';
        badge.classList.replace('bg-gray-100', 'bg-red-50');
        badge.classList.replace('text-gray-700', 'text-red-700');
      }
    });
  });
}

/**
 * Sets up search, clear, and sort listeners.
 */
function bindEvents() {
  const searchInput = document.getElementById('announcement-search');
  const clearBtn = document.getElementById('search-clear-btn');
  const sortSelect = document.getElementById('announcement-sort');
  const emptyResetBtn = document.getElementById('empty-reset-btn');
  const retryBtn = document.getElementById('retry-btn');

  searchInput?.addEventListener('input', () => {
    if (searchInput.value.trim().length > 0) {
      clearBtn?.classList.remove('hidden');
    } else {
      clearBtn?.classList.add('hidden');
    }
    renderAnnouncements();
  });

  clearBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    clearBtn.classList.add('hidden');
    searchInput?.focus();
    renderAnnouncements();
  });

  emptyResetBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    clearBtn?.classList.add('hidden');
    renderAnnouncements();
  });

  sortSelect?.addEventListener('change', () => {
    renderAnnouncements();
  });

  retryBtn?.addEventListener('click', () => {
    loadAnnouncements();
  });
}

// Bootstrap once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

