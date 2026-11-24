/**
 * Administrator User Management Controller
 * Handles user directory queries, account standing management (enable/disable),
 * role protection safeguards, and self-lockout prevention.
 */
import { initShell } from '../../components.js';
import { requireAdmin } from '../../guards.js';
import api from '../../api.js';
import { getUser } from '../../auth.js';
import { formatDate, escapeHtml, showToast } from '../../utils.js';

// Enforce admin authorization
if (!requireAdmin()) {
  // If unauthorized, requireAdmin redirects immediately
}

let allUsers = [];
let pendingAction = null; // { id, name, targetStatus: 'enable' | 'disable' }
let currentPage = 1;
const PAGE_SIZE = 10;

/**
 * Initializes the Admin Users page.
 */
function init() {
  initShell();
  loadUsers();
  bindFilterEvents();
  bindPaginationEvents();
  bindModalEvents();
}

/**
 * Fetches user accounts from GET /api/users across all available pages.
 * Iteratively retrieves pages using the API contract (page, limit) to ensure
 * complete directory visibility for client-side search and filters.
 */
async function loadUsers() {
  const loading = document.getElementById('users-loading');
  const emptyEl = document.getElementById('users-empty');
  const tableContainer = document.getElementById('table-container');

  loading?.classList.remove('hidden');
  emptyEl?.classList.add('hidden');
  tableContainer?.classList.add('hidden');

  try {
    const limit = 50;
    let page = 1;
    let collected = [];

    while (true) {
      const res = await new Promise((resolve, reject) => {
        api.get(`/users?page=${page}&limit=${limit}`)
          .done(resolve)
          .fail(reject);
      });

      const rows = Array.isArray(res?.data) ? res.data : [];
      collected = collected.concat(rows);

      // If returned items count is less than the page limit, we reached the end
      if (rows.length < limit) {
        break;
      }
      page += 1;
      if (page > 50) break; // Guard against runaway loops
    }

    allUsers = collected;
    currentPage = 1;
    renderUsersTable();
  } catch (xhr) {
    loading?.classList.add('hidden');
    showAlert(xhr?.responseJSON?.message || 'Failed to retrieve user accounts from the database.', 'error');
  }
}

/**
 * Filters and renders users in the management table with pagination.
 */
function renderUsersTable() {
  const loading = document.getElementById('users-loading');
  const emptyEl = document.getElementById('users-empty');
  const tableContainer = document.getElementById('table-container');
  const tbody = document.getElementById('users-tbody');
  const emptyResetBtn = document.getElementById('empty-reset-btn');
  const emptyTitle = document.getElementById('empty-title');
  const emptyDesc = document.getElementById('empty-desc');

  loading?.classList.add('hidden');

  const currentAdmin = getUser();
  const currentAdminId = currentAdmin?.id;

  const searchTerm = (document.getElementById('user-search')?.value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('filter-status')?.value || 'all';
  const roleFilter = document.getElementById('filter-role')?.value || 'all';

  const filtered = allUsers.filter((u) => {
    // Status filter
    if (statusFilter === 'active' && !u.is_active) return false;
    if (statusFilter === 'disabled' && u.is_active) return false;

    // Role filter
    if (roleFilter !== 'all' && (u.role || '').toLowerCase() !== roleFilter.toLowerCase()) {
      return false;
    }

    // Keyword search
    if (searchTerm) {
      const matchName = (u.full_name || '').toLowerCase().includes(searchTerm);
      const matchEmail = (u.email || '').toLowerCase().includes(searchTerm);
      return matchName || matchEmail;
    }

    return true;
  });

  if (filtered.length === 0) {
    tableContainer?.classList.add('hidden');
    emptyEl?.classList.remove('hidden');

    if (searchTerm || statusFilter !== 'all' || roleFilter !== 'all') {
      if (emptyTitle) emptyTitle.textContent = 'No Matching Users Found';
      if (emptyDesc) emptyDesc.textContent = 'No user accounts match your selected filter criteria.';
      if (emptyResetBtn) emptyResetBtn.classList.remove('hidden');
    } else {
      if (emptyTitle) emptyTitle.textContent = 'No Users in Directory';
      if (emptyDesc) emptyDesc.textContent = 'There are currently no registered users found in the portal.';
      if (emptyResetBtn) emptyResetBtn.classList.add('hidden');
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
  const pagedUsers = filtered.slice(startIndex, endIndex);

  if (!tbody) return;

  tbody.innerHTML = pagedUsers.map((u) => {
    const isSelf = String(u.id) === String(currentAdminId);
    const isAdminRole = u.role === 'admin';
    const isActive = Boolean(u.is_active);

    // Avatar initials
    const initials = (u.full_name || 'User')
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const roleBadge = isAdminRole
      ? '<span class="badge bg-teal text-white text-xs font-semibold px-2 py-0.5 rounded">Administrator</span>'
      : '<span class="badge bg-soft-mint text-deep-teal text-xs font-semibold px-2 py-0.5 rounded">Community Member</span>';

    const statusBadge = isActive
      ? '<span class="badge bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5 rounded">Active</span>'
      : '<span class="badge bg-red-100 text-red-800 text-xs font-semibold px-2 py-0.5 rounded">Disabled</span>';

    // Action button with self-lockout safeguard
    let actionBtn = '';
    if (isSelf) {
      actionBtn = '<span class="text-xs text-gray-400 italic font-medium px-2 py-1">Current Session</span>';
    } else if (isActive) {
      actionBtn = `
        <button type="button"
                class="btn-toggle-status px-2.5 py-1 text-xs font-medium rounded text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 cursor-pointer transition"
                data-id="${u.id}"
                data-name="${escapeHtml(u.full_name)}"
                data-action="disable">
          Disable Account
        </button>`;
    } else {
      actionBtn = `
        <button type="button"
                class="btn-toggle-status px-2.5 py-1 text-xs font-medium rounded text-green-800 bg-green-50 hover:bg-green-100 border border-green-300 cursor-pointer transition"
                data-id="${u.id}"
                data-name="${escapeHtml(u.full_name)}"
                data-action="enable">
          Enable Account
        </button>`;
    }

    return `
      <tr class="hover:bg-gray-50/80 transition-colors" data-id="${u.id}">
        <td class="py-3.5 px-4 sm:px-6">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-soft-mint text-deep-teal flex items-center justify-center font-heading font-bold text-xs flex-shrink-0">
              ${initials || 'U'}
            </div>
            <div>
              <div class="font-semibold text-gray-900 leading-snug flex items-center gap-1.5 flex-wrap">
                <span>${escapeHtml(u.full_name)}</span>
                ${isSelf ? '<span class="badge bg-amber-100 text-amber-800 text-[10px] font-mono px-1.5 py-0.2 rounded font-bold">You</span>' : ''}
              </div>
              <p class="text-xs text-gray-500 font-mono mt-0.5">${escapeHtml(u.email)}</p>
            </div>
          </div>
        </td>
        <td class="py-3.5 px-4 sm:px-6 whitespace-nowrap">
          ${roleBadge}
        </td>
        <td class="py-3.5 px-4 sm:px-6 whitespace-nowrap">
          ${statusBadge}
        </td>
        <td class="py-3.5 px-4 sm:px-6 whitespace-nowrap text-xs text-gray-500">
          ${formatDate(u.created_at)}
        </td>
        <td class="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
          ${actionBtn}
        </td>
      </tr>
    `;
  }).join('');

  renderPaginationBar(totalCount, totalPages, startIndex, endIndex);
  bindTableActionEvents();
}

/**
 * Renders pagination summary label and page navigation buttons.
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
          renderUsersTable();
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
      renderUsersTable();
    }
  });

  nextBtn?.addEventListener('click', () => {
    currentPage += 1;
    renderUsersTable();
  });
}

/**
 * Attaches action listeners to dynamically rendered table buttons.
 */
function bindTableActionEvents() {
  document.querySelectorAll('.btn-toggle-status').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const name = btn.getAttribute('data-name');
      const action = btn.getAttribute('data-action');
      openStatusModal(id, name, action);
    });
  });
}

/**
 * Opens confirmation modal for enabling or disabling an account.
 * Accurate wording reflects that the current backend records status for auditing
 * and portal display without enforcing session revocation or login blocking.
 * @param {string} id
 * @param {string} name
 * @param {'enable'|'disable'} action
 */
function openStatusModal(id, name, action) {
  pendingAction = { id, name, targetStatus: action };

  const modal = document.getElementById('status-modal');
  const iconContainer = document.getElementById('status-modal-icon-container');
  const titleEl = document.getElementById('status-modal-title');
  const descEl = document.getElementById('status-modal-desc');
  const confirmBtn = document.getElementById('confirm-status-btn');

  if (action === 'disable') {
    if (iconContainer) {
      iconContainer.className = 'w-12 h-12 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4';
      iconContainer.innerHTML = `
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
        </svg>`;
    }
    if (titleEl) titleEl.textContent = 'Disable User Account?';
    if (descEl) descEl.textContent = `Are you sure you want to set ${name}'s account status to Disabled in the portal directory? Note: Disabling updates the user's directory record; the current backend does not automatically revoke active session tokens or block login for disabled accounts.`;
    if (confirmBtn) {
      confirmBtn.className = 'px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md cursor-pointer transition';
      confirmBtn.textContent = 'Yes, Disable Account';
    }
  } else {
    if (iconContainer) {
      iconContainer.className = 'w-12 h-12 mx-auto rounded-full bg-green-100 text-green-700 flex items-center justify-center mb-4';
      iconContainer.innerHTML = `
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>`;
    }
    if (titleEl) titleEl.textContent = 'Enable User Account?';
    if (descEl) descEl.textContent = `Are you sure you want to set ${name}'s account status to Active in the portal directory?`;
    if (confirmBtn) {
      confirmBtn.className = 'px-5 py-2 text-sm font-semibold text-white bg-teal hover:bg-deep-teal rounded-md cursor-pointer transition';
      confirmBtn.textContent = 'Yes, Enable Account';
    }
  }

  modal?.classList.remove('hidden');
}

/**
 * Binds confirmation modal events.
 */
function bindModalEvents() {
  const modal = document.getElementById('status-modal');
  const cancelBtn = document.getElementById('cancel-status-btn');
  const confirmBtn = document.getElementById('confirm-status-btn');
  const alertClose = document.getElementById('users-alert-close');

  const closeModal = () => {
    modal?.classList.add('hidden');
    pendingAction = null;
  };

  cancelBtn?.addEventListener('click', closeModal);

  confirmBtn?.addEventListener('click', () => {
    if (!pendingAction) return;

    const { id, targetStatus, name } = pendingAction;
    const endpoint = `/users/${id}/${targetStatus}`;

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Updating…';

    api.patch(endpoint, {})
      .done(() => {
        closeModal();
        const actionVerb = targetStatus === 'enable' ? 'enabled' : 'disabled';
        showToast(`Account for ${name} has been ${actionVerb}`, 'success');
        showAlert(`Account for ${name} was ${actionVerb} successfully.`, 'success');
        loadUsers();
      })
      .fail((xhr) => {
        showAlert(xhr.responseJSON?.message || `Failed to ${targetStatus} user account.`, 'error');
      })
      .always(() => {
        confirmBtn.disabled = false;
      });
  });

  alertClose?.addEventListener('click', () => {
    document.getElementById('users-alert')?.classList.add('hidden');
  });
}

/**
 * Binds search and filter controls.
 */
function bindFilterEvents() {
  const searchInput = document.getElementById('user-search');
  const clearBtn = document.getElementById('search-clear-btn');
  const statusSelect = document.getElementById('filter-status');
  const roleSelect = document.getElementById('filter-role');
  const resetBtn = document.getElementById('empty-reset-btn');

  searchInput?.addEventListener('input', () => {
    if (searchInput.value.trim().length > 0) {
      clearBtn?.classList.remove('hidden');
    } else {
      clearBtn?.classList.add('hidden');
    }
    currentPage = 1;
    renderUsersTable();
  });

  clearBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    clearBtn.classList.add('hidden');
    searchInput?.focus();
    currentPage = 1;
    renderUsersTable();
  });

  statusSelect?.addEventListener('change', () => {
    currentPage = 1;
    renderUsersTable();
  });

  roleSelect?.addEventListener('change', () => {
    currentPage = 1;
    renderUsersTable();
  });

  resetBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    clearBtn?.classList.add('hidden');
    if (statusSelect) statusSelect.value = 'all';
    if (roleSelect) roleSelect.value = 'all';
    currentPage = 1;
    renderUsersTable();
  });
}

/**
 * Displays top alert banner.
 * @param {string} msg
 * @param {'info'|'error'|'success'} type
 */
function showAlert(msg, type = 'info') {
  const alertEl = document.getElementById('users-alert');
  const msgEl = document.getElementById('users-alert-message');
  const iconEl = document.getElementById('users-alert-icon');

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
