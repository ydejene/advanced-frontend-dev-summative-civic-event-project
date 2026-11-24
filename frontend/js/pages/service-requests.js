/**
 * User Service Requests Page Controller
 * Manages resident service request submissions, client-side input validation,
 * ownership-filtered retrieval from localStorage, and detailed request inspection.
 */
import { initShell } from '../components.js';
import { requireAuth } from '../guards.js';
import { getUser } from '../auth.js';
import { formatDate, escapeHtml, showToast } from '../utils.js';
import {
  SERVICE_TYPES,
  getUserRequests,
  createRequest,
  getStatusBadgeClass,
  isStorageAvailable
} from '../serviceRequests.js';

// Route guard: Require authenticated user session
if (!requireAuth()) {
  // If unauthenticated, requireAuth redirects immediately
}

let activeStatusFilter = 'all';
let activeCategoryFilter = 'all';
let searchQuery = '';
let userRequests = [];

/**
 * Initializes the Service Requests page.
 */
function init() {
  initShell();
  populateCategorySelects();
  bindFormEvents();
  bindFilterEvents();
  bindModalEvents();
  loadRequests();

  window.addEventListener('auth-state-changed', () => {
    if (!requireAuth()) return;
    loadRequests();
  });
}

/**
 * Populates category dropdown options in the submission form and filter bar.
 */
function populateCategorySelects() {
  const formSelect = document.getElementById('req-category');
  const filterSelect = document.getElementById('filter-category');

  if (formSelect) {
    SERVICE_TYPES.forEach((type) => {
      const opt = document.createElement('option');
      opt.value = type;
      opt.textContent = type;
      formSelect.appendChild(opt);
    });
  }

  if (filterSelect) {
    SERVICE_TYPES.forEach((type) => {
      const opt = document.createElement('option');
      opt.value = type;
      opt.textContent = type;
      filterSelect.appendChild(opt);
    });
  }
}

/**
 * Loads requests belonging exclusively to the authenticated user from localStorage.
 */
function loadRequests() {
  const user = getUser();
  if (!user || !user.id) return;

  if (!isStorageAvailable()) {
    showAlert('Browser localStorage is not available. Service requests cannot be saved.', 'error');
    return;
  }

  userRequests = getUserRequests(user.id);
  updateCounts();
  renderRequests();
}

/**
 * Updates status filter tab count indicators.
 */
function updateCounts() {
  const countAll = document.getElementById('count-all');
  const countSubmitted = document.getElementById('count-submitted');
  const countInReview = document.getElementById('count-in-review');
  const countResolved = document.getElementById('count-resolved');
  const countRejected = document.getElementById('count-rejected');

  const total = userRequests.length;
  const submitted = userRequests.filter(r => r.status === 'Submitted').length;
  const inReview = userRequests.filter(r => r.status === 'In Review').length;
  const resolved = userRequests.filter(r => r.status === 'Resolved').length;
  const rejected = userRequests.filter(r => r.status === 'Rejected').length;

  if (countAll) countAll.textContent = String(total);
  if (countSubmitted) countSubmitted.textContent = String(submitted);
  if (countInReview) countInReview.textContent = String(inReview);
  if (countResolved) countResolved.textContent = String(resolved);
  if (countRejected) countRejected.textContent = String(rejected);
}

/**
 * Filters and renders requests based on active tab, category, and search text.
 */
function renderRequests() {
  const listEl = document.getElementById('requests-list');
  const emptyEl = document.getElementById('requests-empty');
  const emptyTitle = document.getElementById('empty-title');
  const emptyDesc = document.getElementById('empty-desc');

  if (!listEl) return;

  const filtered = userRequests.filter((req) => {
    // Status filter
    if (activeStatusFilter !== 'all' && req.status !== activeStatusFilter) {
      return false;
    }

    // Category filter
    if (activeCategoryFilter !== 'all' && req.category !== activeCategoryFilter) {
      return false;
    }

    // Search query
    if (searchQuery) {
      const matchTitle = (req.title || '').toLowerCase().includes(searchQuery);
      const matchDesc = (req.description || '').toLowerCase().includes(searchQuery);
      const matchLocation = (req.location || '').toLowerCase().includes(searchQuery);
      const matchCategory = (req.category || '').toLowerCase().includes(searchQuery);
      return matchTitle || matchDesc || matchLocation || matchCategory;
    }

    return true;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = '';
    emptyEl?.classList.remove('hidden');

    if (userRequests.length === 0) {
      if (emptyTitle) emptyTitle.textContent = 'No Service Requests Yet';
      if (emptyDesc) emptyDesc.textContent = 'You have not submitted any service requests in this browser yet. Notice an issue in your area?';
    } else {
      if (emptyTitle) emptyTitle.textContent = 'No Matching Requests';
      if (emptyDesc) emptyDesc.textContent = 'No requests match your selected status tab, category, or search keywords.';
    }
    return;
  }

  emptyEl?.classList.add('hidden');

  listEl.innerHTML = filtered.map((req) => {
    const badgeClass = getStatusBadgeClass(req.status);
    const locationSnippet = req.location
      ? `<div class="flex items-center gap-1 text-xs text-gray-500 mt-1">
           <svg class="w-3.5 h-3.5 text-teal flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
           </svg>
           <span class="truncate">${escapeHtml(req.location)}</span>
         </div>`
      : '';

    const hasNotes = Boolean(req.status_notes && req.status_notes.trim());
    const notesCallout = hasNotes
      ? `<div class="mt-3 p-2.5 bg-teal/5 border border-teal/20 rounded-md text-xs text-deep-teal">
           <span class="font-semibold block mb-0.5">Admin Update:</span>
           <p class="line-clamp-2">${escapeHtml(req.status_notes)}</p>
         </div>`
      : '';

    return `
      <article class="card p-5 sm:p-6 border border-gray-200 hover:border-teal/30 hover:shadow-xs transition" data-id="${req.id}">
        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div class="space-y-1.5 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-mono text-xs font-semibold text-deep-teal">${req.id}</span>
              <span class="badge-teal text-[11px] font-semibold px-2 py-0.5 rounded">${escapeHtml(req.category)}</span>
              <span class="badge text-[11px] font-semibold px-2.5 py-0.5 rounded border ${badgeClass}">${req.status}</span>
            </div>
            <h3 class="text-base font-heading font-bold text-gray-900 leading-snug">
              ${escapeHtml(req.title)}
            </h3>
            ${locationSnippet}
          </div>

          <div class="text-xs text-gray-400 sm:text-right flex-shrink-0">
            <span>Submitted ${formatDate(req.created_at)}</span>
          </div>
        </div>

        <p class="text-xs sm:text-sm text-gray-600 mt-3 line-clamp-2 leading-relaxed">
          ${escapeHtml(req.description)}
        </p>

        ${notesCallout}

        <div class="flex items-center justify-between pt-4 mt-4 border-t border-gray-100">
          <span class="text-[11px] text-gray-400 italic">Demonstration record (localStorage)</span>
          <button type="button"
                  class="btn-view-details text-xs font-semibold text-teal hover:text-deep-teal inline-flex items-center gap-1 cursor-pointer"
                  data-id="${req.id}">
            <span>View Full Details</span>
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </article>
    `;
  }).join('');

  bindCardActionEvents();
}

/**
 * Attaches click listeners to request cards for viewing details.
 */
function bindCardActionEvents() {
  document.querySelectorAll('.btn-view-details').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const req = userRequests.find(r => r.id === id);
      if (req) openDetailsModal(req);
    });
  });
}

/**
 * Binds form toggle, submission, reset, and character count events.
 */
function bindFormEvents() {
  const formSection = document.getElementById('form-section');
  const toggleBtn = document.getElementById('toggle-new-request-btn');
  const cancelTopBtn = document.getElementById('form-cancel-top-btn');
  const cancelBtn = document.getElementById('form-cancel-btn');
  const emptyCreateBtn = document.getElementById('empty-create-btn');
  const form = document.getElementById('new-request-form');
  const descTextarea = document.getElementById('req-description');
  const charCount = document.getElementById('desc-char-count');
  const alertClose = document.getElementById('request-alert-close');

  const showForm = () => {
    formSection?.classList.remove('hidden');
    formSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('req-category')?.focus();
  };

  const hideForm = () => {
    formSection?.classList.add('hidden');
    form?.reset();
    clearValidationErrors();
    if (charCount) charCount.textContent = '0 / 2000';
  };

  toggleBtn?.addEventListener('click', () => {
    if (formSection?.classList.contains('hidden')) {
      showForm();
    } else {
      hideForm();
    }
  });

  cancelTopBtn?.addEventListener('click', hideForm);
  cancelBtn?.addEventListener('click', hideForm);
  emptyCreateBtn?.addEventListener('click', showForm);

  descTextarea?.addEventListener('input', () => {
    const len = descTextarea.value.length;
    if (charCount) charCount.textContent = `${len} / 2000`;
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    handleFormSubmit();
  });

  alertClose?.addEventListener('click', () => {
    document.getElementById('request-alert')?.classList.add('hidden');
  });
}

/**
 * Validates and submits a new request record.
 */
function handleFormSubmit() {
  clearValidationErrors();

  const user = getUser();
  const categoryInput = document.getElementById('req-category');
  const titleInput = document.getElementById('req-title');
  const descInput = document.getElementById('req-description');
  const locationInput = document.getElementById('req-location');
  const submitBtn = document.getElementById('form-submit-btn');

  const category = (categoryInput?.value || '').trim();
  const title = (titleInput?.value || '').trim();
  const description = (descInput?.value || '').trim();
  const location = (locationInput?.value || '').trim();

  let hasError = false;

  if (!category || !SERVICE_TYPES.includes(category)) {
    showFieldError('category-error', 'Please choose a service category.');
    categoryInput?.focus();
    hasError = true;
  }

  if (!title || title.length < 3) {
    showFieldError('title-error', 'Subject must be at least 3 characters.');
    if (!hasError) titleInput?.focus();
    hasError = true;
  } else if (title.length > 120) {
    showFieldError('title-error', 'Subject cannot exceed 120 characters.');
    if (!hasError) titleInput?.focus();
    hasError = true;
  }

  if (!description || description.length < 10) {
    showFieldError('desc-error', 'Please provide a detailed description (minimum 10 characters).');
    if (!hasError) descInput?.focus();
    hasError = true;
  } else if (description.length > 2000) {
    showFieldError('desc-error', 'Description cannot exceed 2000 characters.');
    if (!hasError) descInput?.focus();
    hasError = true;
  }

  if (hasError) return;

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';
  }

  const result = createRequest({ category, title, description, location }, user);

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Request';
  }

  if (!result.success) {
    showAlert(result.error || 'Failed to record service request.', 'error');
    return;
  }

  showToast(`Service request ${result.request.id} created and stored locally.`, 'success');
  showAlert(`Your service request (${result.request.id}) has been recorded in your browser's local store.`, 'success');

  // Reset form and collapse
  const form = document.getElementById('new-request-form');
  form?.reset();
  document.getElementById('form-section')?.classList.add('hidden');
  const charCount = document.getElementById('desc-char-count');
  if (charCount) charCount.textContent = '0 / 2000';

  loadRequests();
}

/**
 * Binds tab selection, category filter, and search inputs.
 */
function bindFilterEvents() {
  // Status tabs
  const tabs = document.querySelectorAll('.status-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.className = 'status-tab px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors cursor-pointer';
        t.setAttribute('aria-selected', 'false');
      });
      tab.className = 'status-tab px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer bg-teal text-white';
      tab.setAttribute('aria-selected', 'true');

      activeStatusFilter = tab.getAttribute('data-status') || 'all';
      renderRequests();
    });
  });

  // Category filter
  const filterCat = document.getElementById('filter-category');
  filterCat?.addEventListener('change', () => {
    activeCategoryFilter = filterCat.value || 'all';
    renderRequests();
  });

  // Search input
  const searchInput = document.getElementById('filter-search');
  searchInput?.addEventListener('input', () => {
    searchQuery = searchInput.value.trim().toLowerCase();
    renderRequests();
  });
}

/**
 * Binds details inspection modal events.
 */
function bindModalEvents() {
  const modal = document.getElementById('details-modal');
  const closeBtn = document.getElementById('modal-close-btn');
  const dismissBtn = document.getElementById('modal-dismiss-btn');

  const closeModal = () => {
    modal?.classList.add('hidden');
  };

  closeBtn?.addEventListener('click', closeModal);
  dismissBtn?.addEventListener('click', closeModal);

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal?.classList.contains('hidden')) {
      closeModal();
    }
  });
}

/**
 * Populates and reveals the details modal for a single request.
 * @param {Object} req
 */
function openDetailsModal(req) {
  const modal = document.getElementById('details-modal');
  const modalCategory = document.getElementById('modal-category');
  const modalTitle = document.getElementById('modal-title');
  const modalId = document.getElementById('modal-id');
  const modalStatus = document.getElementById('modal-status');
  const modalDate = document.getElementById('modal-date');
  const modalUpdated = document.getElementById('modal-updated');
  const modalLocationContainer = document.getElementById('modal-location-container');
  const modalLocationText = document.getElementById('modal-location-text');
  const modalDescription = document.getElementById('modal-description');
  const modalNotesContainer = document.getElementById('modal-notes-container');
  const modalNotes = document.getElementById('modal-notes');

  if (modalCategory) modalCategory.textContent = req.category;
  if (modalTitle) modalTitle.textContent = req.title;
  if (modalId) modalId.textContent = `Tracking ID: ${req.id}`;

  if (modalStatus) {
    modalStatus.textContent = req.status;
    modalStatus.className = `badge text-xs font-semibold px-2.5 py-0.5 rounded border ${getStatusBadgeClass(req.status)}`;
  }

  if (modalDate) modalDate.textContent = formatDate(req.created_at);
  if (modalUpdated) modalUpdated.textContent = formatDate(req.updated_at);

  if (modalLocationContainer && modalLocationText) {
    if (req.location) {
      modalLocationText.textContent = req.location;
      modalLocationContainer.classList.remove('hidden');
    } else {
      modalLocationContainer.classList.add('hidden');
    }
  }

  if (modalDescription) modalDescription.textContent = req.description;

  if (modalNotesContainer && modalNotes) {
    if (req.status_notes && req.status_notes.trim()) {
      modalNotes.textContent = req.status_notes;
      modalNotesContainer.classList.remove('hidden');
    } else {
      modalNotesContainer.classList.add('hidden');
    }
  }

  modal?.classList.remove('hidden');
}

/**
 * Displays an error on a specific form field.
 * @param {string} elementId
 * @param {string} msg
 */
function showFieldError(elementId, msg) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = msg;
    el.classList.remove('hidden');
  }
}

/**
 * Clears all inline form validation errors.
 */
function clearValidationErrors() {
  document.querySelectorAll('#new-request-form p[id$="-error"]').forEach((p) => {
    p.textContent = '';
    p.classList.add('hidden');
  });
}

/**
 * Displays a top alert banner.
 * @param {string} msg
 * @param {'info'|'error'|'success'} type
 */
function showAlert(msg, type = 'info') {
  const alertEl = document.getElementById('request-alert');
  const msgEl = document.getElementById('request-alert-message');
  const iconEl = document.getElementById('request-alert-icon');

  if (!alertEl || !msgEl) return;

  msgEl.textContent = msg;

  if (type === 'error') {
    alertEl.className = 'card p-4 mb-6 bg-red-50 border border-red-200 text-red-800';
    if (iconEl) iconEl.innerHTML = '<svg class="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
  } else {
    alertEl.className = 'card p-4 mb-6 bg-green-50 border border-green-200 text-green-800';
    if (iconEl) iconEl.innerHTML = '<svg class="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
  }

  alertEl.classList.remove('hidden');
}

// Bootstrap on DOM readiness
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

