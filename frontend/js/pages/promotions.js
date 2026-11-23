/**
 * Promotions Listing Controller
 * Manages civic video campaigns discovery, native HTML5 video player previews,
 * accessible caption indicators, client-side search/sort, and auth-aware guest prompts.
 */
import { initShell } from '../components.js';
import { isAuthenticated, isAdmin } from '../auth.js';
import api from '../api.js';
import { formatDate, escapeHtml, truncate } from '../utils.js';

let allPromos = [];

/**
 * Initializes the Promotions page.
 */
function init() {
  initShell('promotions');

  checkAuthAndLoad();

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

  loadPromos();
}

/**
 * Fetches promotions from backend API.
 */
function loadPromos() {
  const loading = document.getElementById('promos-loading');
  const errorEl = document.getElementById('promos-error');
  const emptyEl = document.getElementById('promos-empty');
  const gridEl = document.getElementById('promos-grid');

  loading?.classList.remove('hidden');
  errorEl?.classList.add('hidden');
  emptyEl?.classList.add('hidden');
  gridEl?.classList.add('hidden');

  api.get('/promos?limit=50')
    .done((res) => {
      // Backend returns { status: 200, data: [...], pagination: {...} }
      const items = Array.isArray(res?.data) ? res.data : [];
      allPromos = items;
      renderPromos();
    })
    .fail((xhr) => {
      loading?.classList.add('hidden');
      if (xhr.status !== 401) {
        errorEl?.classList.remove('hidden');
        const msg = xhr.responseJSON?.message || 'Unable to load promotions. Please try again.';
        const errDesc = document.getElementById('error-message');
        if (errDesc) errDesc.textContent = msg;
      }
    });
}

/**
 * Filters, sorts, and renders promo cards in the grid.
 */
function renderPromos() {
  const loading = document.getElementById('promos-loading');
  const emptyEl = document.getElementById('promos-empty');
  const gridEl = document.getElementById('promos-grid');
  const emptyResetBtn = document.getElementById('empty-reset-btn');
  const emptyTitle = document.getElementById('empty-title');
  const emptyDesc = document.getElementById('empty-desc');

  loading?.classList.add('hidden');

  const searchTerm = (document.getElementById('promo-search')?.value || '').trim().toLowerCase();
  const sortOrder = document.getElementById('promo-sort')?.value || 'newest';
  const admin = isAdmin();

  let filtered = allPromos.filter((item) => {
    if (!admin && !item.published) return false;
    if (searchTerm) {
      const matchTitle = (item.title || '').toLowerCase().includes(searchTerm);
      const matchDesc = (item.description || '').toLowerCase().includes(searchTerm);
      return matchTitle || matchDesc;
    }
    return true;
  });

  filtered.sort((a, b) => {
    if (sortOrder === 'oldest') {
      return new Date(a.created_at) - new Date(b.created_at);
    } else if (sortOrder === 'title') {
      return (a.title || '').localeCompare(b.title || '');
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });

  if (filtered.length === 0) {
    gridEl?.classList.add('hidden');
    emptyEl?.classList.remove('hidden');

    if (searchTerm) {
      if (emptyTitle) emptyTitle.textContent = 'No Promotions Match Your Search';
      if (emptyDesc) emptyDesc.textContent = `No video promotions found matching "${searchTerm}". Try a different keyword.`;
      if (emptyResetBtn) emptyResetBtn.classList.remove('hidden');
    } else {
      if (emptyTitle) emptyTitle.textContent = 'No Promotions Published';
      if (emptyDesc) emptyDesc.textContent = 'There are currently no civic video promotions available. Please check back later.';
      if (emptyResetBtn) emptyResetBtn.classList.add('hidden');
    }
    return;
  }

  emptyEl?.classList.add('hidden');
  gridEl?.classList.remove('hidden');

  gridEl.innerHTML = filtered.map((promo) => {
    const publishedBadge = admin
      ? (promo.published
          ? '<span class="badge bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5 rounded">Published</span>'
          : '<span class="badge bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded">Draft</span>')
      : '';

    const hasCaption = Boolean(promo.caption_text && promo.caption_text.trim());
    const captionBadge = hasCaption
      ? '<span class="badge bg-soft-mint text-deep-teal text-xs font-medium px-2 py-0.5 rounded inline-flex items-center gap-1"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>Captions Included</span>'
      : '';

    return `
      <article class="card overflow-hidden flex flex-col border border-gray-200 transition-shadow hover:shadow-md" data-promo-id="${promo.id}">
        <!-- Video Preview Container -->
        <div class="relative bg-black w-full aspect-video flex items-center justify-center overflow-hidden">
          <video controls preload="metadata" class="w-full h-full object-contain">
            <source src="${escapeHtml(promo.video_url)}" type="video/mp4">
            Your browser does not support the video tag.
          </video>
        </div>

        <div class="p-5 flex-1 flex flex-col justify-between">
          <div>
            <div class="flex items-center gap-2 mb-2 flex-wrap">
              ${captionBadge}
              ${publishedBadge}
              <time class="text-xs text-gray-500 ml-auto" datetime="${promo.created_at}">${formatDate(promo.created_at)}</time>
            </div>

            <h2 class="text-lg font-heading font-bold text-deep-teal tracking-tight mb-2">
              <a href="/pages/promotions/detail.html?id=${promo.id}" class="hover:text-teal focus-visible:outline-2 focus-visible:outline-teal rounded">
                ${escapeHtml(promo.title)}
              </a>
            </h2>

            <p class="text-sm text-gray-600 line-clamp-3 mb-4 leading-relaxed">
              ${escapeHtml(truncate(promo.description, 130))}
            </p>
          </div>

          <div class="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span class="text-gray-500">Civic Video Feature</span>
            <a href="/pages/promotions/detail.html?id=${promo.id}"
               class="font-semibold text-teal hover:text-deep-teal inline-flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-teal rounded">
              Watch &amp; Captions &rarr;
            </a>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

/**
 * Sets up search, clear, and sort listeners.
 */
function bindEvents() {
  const searchInput = document.getElementById('promo-search');
  const clearBtn = document.getElementById('search-clear-btn');
  const sortSelect = document.getElementById('promo-sort');
  const emptyResetBtn = document.getElementById('empty-reset-btn');
  const retryBtn = document.getElementById('retry-btn');

  searchInput?.addEventListener('input', () => {
    if (searchInput.value.trim().length > 0) {
      clearBtn?.classList.remove('hidden');
    } else {
      clearBtn?.classList.add('hidden');
    }
    renderPromos();
  });

  clearBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    clearBtn.classList.add('hidden');
    searchInput?.focus();
    renderPromos();
  });

  emptyResetBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    clearBtn?.classList.add('hidden');
    renderPromos();
  });

  sortSelect?.addEventListener('change', () => {
    renderPromos();
  });

  retryBtn?.addEventListener('click', () => {
    loadPromos();
  });
}

// Bootstrap once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

