/**
 * Administrator Service Requests Management Controller
 * Handles local storage request inspection, category/status filtering,
 * keyword searching, pagination, and status lifecycle transitions.
 */
import { initShell } from '../../components.js';
import { requireAdmin } from '../../guards.js';
import { formatDate, escapeHtml, showToast } from '../../utils.js';
import {
  SERVICE_TYPES,
  getAllRequests,
  updateRequestStatus,
  getStatusBadgeClass,
  isStorageAvailable
} from '../../serviceRequests.js';

// Route guard: Require administrator authorization
if (!requireAdmin()) {
  // If unauthorized, requireAdmin redirects immediately
}

let allRequests = [];
let currentPage = 1;
const PAGE_SIZE = 10;
let currentEditingId = null;

/**
 * Initializes the Admin Service Requests page.
 */
function init() {
  initShell();
  populateCategorySelect();
  bindFilterEvents();
  bindPaginationEvents();
  bindModalEvents();
  loadRequests();
}

/**
 * Populates category options in the filter dropdown.
 */
function populateCategorySelect() {
  const select = document.getElementById('admin-filter-category');
  if (!select) return;

  SERVICE_TYPES.forEach((type) => {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = type;
    select.appendChild(opt);
  });
}

/**
 * Retrieves all requests from localStorage across all submitters.
 */
function loadRequests() {
  if (!isStorageAvailable()) {
    showAlert('Browser localStorage is inaccessible. Requests cannot be retrieved.', 'error');
    return;
  }

  allRequests = getAllRequests();
  updateKPIs();
  renderTable();
}

/**
 * Updates top overview KPI metric counters.
 */
function updateKPIs() {
  const kpiTotal = document.getElementById('kpi-total');
  const kpiSubmitted = document.getElementById('kpi-submitted');
  const kpiInReview = document.getElementById('kpi-in-review');
  const kpiResolved = document.getElementById('kpi-resolved');

  const total = allRequests.length;
  const submitted = allRequests.filter(r => r.status === 'Submitted').length;
  const inReview = allRequests.filter(r => r.status === 'In Review').length;
  const resolved = allRequests.filter(r => r.status === 'Resolved').length;

  if (kpiTotal) kpiTotal.textContent = String(total);
  if (kpiSubmitted) kpiSubmitted.textContent = String(submitted);
  if (kpiInReview) kpiInReview.textContent = String(inReview);
  if (kpiResolved) kpiResolved.textContent = String(resolved);
}

/**
 * Filters requests based on search and dropdown selections, then paginates.
 */
function renderTable() {
  const emptyEl = document.getElementById('table-empty');
  const tableContainer = document.getElementById('table-container');
  const tbody = document.getElementById('table-tbody');
  const emptyTitle = document.getElementById('empty-title');
  const emptyDesc = document.getElementById('empty-desc');
  const emptyResetBtn = document.getElementById('empty-reset-btn');

  const searchTerm = (document.getElementById('admin-search')?.value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('admin-filter-status')?.value || 'all';
  const categoryFilter = document.getElementById('admin-filter-category')?.value || 'all';

  const filtered = allRequests.filter((req) => {
    // Status filter
    if (statusFilter !== 'all' && req.status !== statusFilter) {
      return false;
    }

    // Category filter
    if (categoryFilter !== 'all' && req.category !== categoryFilter) {
      return false;
    }

    // Search query
    if (searchTerm) {
      const matchId = (req.id || '').toLowerCase().includes(searchTerm);
      const matchTitle = (req.title || '').toLowerCase().includes(searchTerm);
      const matchDesc = (req.description || '').toLowerCase().includes(searchTerm);
      const matchLocation = (req.location || '').toLowerCase().includes(searchTerm);
      const matchUser = (req.user_name || '').toLowerCase().includes(searchTerm);
      const matchEmail = (req.user_email || '').toLowerCase().includes(searchTerm);
      return matchId || matchTitle || matchDesc || matchLocation || matchUser || matchEmail;
    }

    return true;
  });

  if (filtered.length === 0) {
    tableContainer?.classList.add('hidden');
    emptyEl?.classList.remove('hidden');

    if (allRequests.length === 0) {
      if (emptyTitle) emptyTitle.textContent = 'No Service Requests in Store';
      if (emptyDesc) emptyDesc.textContent = 'No demonstration service requests have been submitted in this browser yet.';
      if (emptyResetBtn) emptyResetBtn.classList.add('hidden');
    } else {
      if (emptyTitle) emptyTitle.textContent = 'No Matching Requests';
      if (emptyDesc) emptyDesc.textContent = 'No requests match your current search keywords or selected filter options.';
      if (emptyResetBtn) emptyResetBtn.classList.remove('hidden');
    }
    return;
  }

  emptyEl?.classList.add('hidden');
  tableContainer?.classList.remove('hidden');

  // Pagination calculation
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalCount);
  const pagedRequests = filtered.slice(startIndex, endIndex);

  if (!tbody) return;

  tbody.innerHTML = pagedRequests.map((req) => {
    const badgeClass = getStatusBadgeClass(req.status);
    const locationInfo = req.location
      ? `<span class="text-[11px] text-gray-500 block truncate max-w-xs mt-0.5">Loc: ${escapeHtml(req.location)}</span>`
      : '';

    return `
      <tr class="hover:bg-gray-50/80 transition-colors" data-id="${req.id}">
        <td class="py-3.5 px-4 sm:px-6">
          <div class="font-mono text-xs font-bold text-deep-teal">${req.id}</div>
          <div class="font-medium text-gray-900 text-sm mt-0.5 max-w-xs sm:max-w-sm truncate" title="${escapeHtml(req.title)}">
            ${escapeHtml(req.title)}
          </div>
          ${locationInfo}
        </td>
        <td class="py-3.5 px-4 sm:px-6 whitespace-nowrap">
          <div class="font-medium text-gray-900 text-xs">${escapeHtml(req.user_name || 'Resident')}</div>
          <div class="font-mono text-[11px] text-gray-500">${escapeHtml(req.user_email || '—')}</div>
        </td>
        <td class="py-3.5 px-4 sm:px-6 whitespace-nowrap">
          <span class="badge-teal text-[11px] font-semibold px-2 py-0.5 rounded">
            ${escapeHtml(req.category)}
          </span>
        </td>
        <td class="py-3.5 px-4 sm:px-6 whitespace-nowrap">
          <span class="badge text-xs font-semibold px-2.5 py-0.5 rounded border ${badgeClass}">
            ${req.status}
          </span>
        </td>
        <td class="py-3.5 px-4 sm:px-6 whitespace-nowrap text-xs text-gray-500">
          ${formatDate(req.created_at)}
        </td>
        <td class="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
          <button type="button"
                  class="btn-review-req px-3 py-1.5 text-xs font-semibold rounded bg-teal text-white hover:bg-deep-teal cursor-pointer transition shadow-xs"
                  data-id="${req.id}">
            Review &amp; Update
          </button>
        </td>
      </tr>
    `;
  }).join('');

  renderPaginationBar(totalCount, totalPages, startIndex, endIndex);
  bindTableActionEvents();
}

/**
 * Renders pagination range summary and numbered page buttons.
 * @param {number} totalCount
 * @param {number} totalPages
 * @param {number} startIndex
 * @param {number} endIndex
 */
function renderPaginationBar(totalCount, totalPages, startIndex, endIndex) {
  const rangeStart = document.getElementById('pagination-range-start');
  const rangeEnd = document.getElementById('pagination-range-end');
  const totalCountEl = document.getElementById('pagination-total-count');
  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');
  const pagesContainer = document.getElementById('pagination-pages');

  if (rangeStart) rangeStart.textContent = totalCount > 0 ? String(startIndex + 1) : '0';
  if (rangeEnd) rangeEnd.textContent = String(endIndex);
  if (totalCountEl) totalCountEl.textContent = String(totalCount);

  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

  if (pagesContainer) {
    let pagesHtml = '';
    for (let p = 1; p <= totalPages; p++) {
      if (p === currentPage) {
        pagesHtml += `<button type="button" class="w-7 h-7 text-xs font-semibold rounded bg-teal text-white cursor-default" aria-current="page">${p}</button>`;
      } else {
        pagesHtml += `<button type="button" class="w-7 h-7 text-xs font-medium rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer btn-page-num" data-page="${p}">${p}</button>`;
      }
    }
    pagesContainer.innerHTML = pagesHtml;

    pagesContainer.querySelectorAll('.btn-page-num').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetPage = Number(btn.getAttribute('data-page'));
        if (targetPage && targetPage !== currentPage) {
          currentPage = targetPage;
          renderTable();
        }
      });
    });
  }
}

/**
 * Attaches pagination previous / next click listeners.
 */
function bindPaginationEvents() {
  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');

  prevBtn?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage -= 1;
      renderTable();
    }
  });

  nextBtn?.addEventListener('click', () => {
    currentPage += 1;
    renderTable();
  });
}

/**
 * Attaches click listeners to table review action buttons.
 */
function bindTableActionEvents() {
  document.querySelectorAll('.btn-review-req').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const req = allRequests.find(r => r.id === id);
      if (req) openReviewModal(req);
    });
  });
}

/**
 * Binds search, status filter, category filter, and clear events.
 */
function bindFilterEvents() {
  const searchInput = document.getElementById('admin-search');
  const clearBtn = document.getElementById('search-clear-btn');
  const statusSelect = document.getElementById('admin-filter-status');
  const categorySelect = document.getElementById('admin-filter-category');
  const resetBtn = document.getElementById('empty-reset-btn');

  searchInput?.addEventListener('input', () => {
    if (searchInput.value.trim().length > 0) {
      clearBtn?.classList.remove('hidden');
    } else {
      clearBtn?.classList.add('hidden');
    }
    currentPage = 1;
    renderTable();
  });

  clearBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    clearBtn.classList.add('hidden');
    searchInput?.focus();
    currentPage = 1;
    renderTable();
  });

  statusSelect?.addEventListener('change', () => {
    currentPage = 1;
    renderTable();
  });

  categorySelect?.addEventListener('change', () => {
    currentPage = 1;
    renderTable();
  });

  resetBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    clearBtn?.classList.add('hidden');
    if (statusSelect) statusSelect.value = 'all';
    if (categorySelect) categorySelect.value = 'all';
    currentPage = 1;
    renderTable();
  });
}

/**
 * Binds review modal dialog events and form submission.
 */
function bindModalEvents() {
  const modal = document.getElementById('review-modal');
  const closeBtn = document.getElementById('modal-close-btn');
  const cancelBtn = document.getElementById('modal-cancel-btn');
  const form = document.getElementById('status-update-form');
  const alertClose = document.getElementById('admin-alert-close');

  const closeModal = () => {
    modal?.classList.add('hidden');
    currentEditingId = null;
  };

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal?.classList.contains('hidden')) {
      closeModal();
    }
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentEditingId) return;

    const statusSelect = document.getElementById('modal-status-select');
    const notesInput = document.getElementById('modal-notes-input');
    const saveBtn = document.getElementById('modal-save-btn');

    const newStatus = statusSelect?.value;
    const notes = notesInput?.value || '';

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
    }

    const res = updateRequestStatus(currentEditingId, newStatus, notes);

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Status Changes';
    }

    if (!res.success) {
      showAlert(res.error || 'Failed to update request status.', 'error');
      return;
    }

    showToast(`Request ${currentEditingId} status updated to ${newStatus}`, 'success');
    showAlert(`Request ${currentEditingId} marked as ${newStatus} in local storage.`, 'success');

    closeModal();
    loadRequests();
  });

  alertClose?.addEventListener('click', () => {
    document.getElementById('admin-alert')?.classList.add('hidden');
  });
}

/**
 * Opens review and status update modal for a specific request.
 * @param {Object} req
 */
function openReviewModal(req) {
  currentEditingId = req.id;

  const modal = document.getElementById('review-modal');
  const modalCategory = document.getElementById('modal-category');
  const modalReqId = document.getElementById('modal-req-id');
  const modalUserName = document.getElementById('modal-user-name');
  const modalUserEmail = document.getElementById('modal-user-email');
  const modalCreatedAt = document.getElementById('modal-created-at');
  const modalUpdatedAt = document.getElementById('modal-updated-at');
  const modalTitle = document.getElementById('modal-title');
  const modalLocationRow = document.getElementById('modal-location-row');
  const modalLocationText = document.getElementById('modal-location-text');
  const modalDescription = document.getElementById('modal-description');
  const statusSelect = document.getElementById('modal-status-select');
  const notesInput = document.getElementById('modal-notes-input');

  if (modalCategory) modalCategory.textContent = req.category;
  if (modalReqId) modalReqId.textContent = `Tracking ID: ${req.id}`;
  if (modalUserName) modalUserName.textContent = req.user_name || 'Resident';
  if (modalUserEmail) modalUserEmail.textContent = req.user_email || 'No email provided';
  if (modalCreatedAt) modalCreatedAt.textContent = formatDate(req.created_at);
  if (modalUpdatedAt) modalUpdatedAt.textContent = formatDate(req.updated_at);
  if (modalTitle) modalTitle.textContent = req.title;

  if (modalLocationRow && modalLocationText) {
    if (req.location) {
      modalLocationText.textContent = req.location;
      modalLocationRow.classList.remove('hidden');
    } else {
      modalLocationRow.classList.add('hidden');
    }
  }

  if (modalDescription) modalDescription.textContent = req.description;

  if (statusSelect) statusSelect.value = req.status;
  if (notesInput) notesInput.value = req.status_notes || '';

  modal?.classList.remove('hidden');
}

/**
 * Displays top alert banner.
 * @param {string} msg
 * @param {'info'|'error'|'success'} type
 */
function showAlert(msg, type = 'info') {
  const alertEl = document.getElementById('admin-alert');
  const msgEl = document.getElementById('admin-alert-message');
  const iconEl = document.getElementById('admin-alert-icon');

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

