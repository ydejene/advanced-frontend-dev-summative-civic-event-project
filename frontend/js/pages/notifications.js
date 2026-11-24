/**
 * Notifications Inbox Controller
 * Manages full notifications inbox view, user-scoped read/unread state tracking,
 * client-side keyword and type filtering, related-resource navigation,
 * and administrator deletion workflows.
 */
import { initShell } from '../components.js';
import { requireAuth } from '../guards.js';
import { getUser, isAdmin } from '../auth.js';
import {
  fetchNotifications,
  getReadNotificationIds,
  isNotificationRead,
  markAsRead,
  markAsUnread,
  markAllAsRead,
  deleteNotification,
  resolveNotificationLink,
  updateNotificationBadge
} from '../notifications.js';
import { formatDateTime, timeAgo, escapeHtml, showToast, openModal, closeModal, setupModalA11y } from '../utils.js';

// Enforce authentication
if (!requireAuth()) {
  // If not authenticated, requireAuth redirects to login
}

let allNotifications = [];
let pendingDeleteId = null;

/**
 * Initializes the Notifications Inbox page.
 */
function init() {
  initShell('notifications');

  // Show admin manage link if admin
  const adminContainer = document.getElementById('admin-manage-link-container');
  if (adminContainer && isAdmin()) {
    adminContainer.classList.remove('hidden');
  }

  loadNotifications();
  bindFilterEvents();
  bindModalEvents();

  window.addEventListener('notifications-updated', () => {
    updateUnreadPill();
    renderNotifications();
  });

  window.addEventListener('auth-state-changed', () => {
    if (!requireAuth()) return;
    loadNotifications();
  });
}

/**
 * Loads notifications from backend API.
 */
function loadNotifications() {
  const loading = document.getElementById('notifications-loading');
  const errorEl = document.getElementById('notifications-error');
  const emptyEl = document.getElementById('notifications-empty');
  const listEl = document.getElementById('notifications-list');

  loading?.classList.remove('hidden');
  errorEl?.classList.add('hidden');
  emptyEl?.classList.add('hidden');
  listEl?.classList.add('hidden');

  fetchNotifications()
    .done((res) => {
      const items = Array.isArray(res?.data) ? res.data : [];
      allNotifications = items;
      updateUnreadPill();
      renderNotifications();
    })
    .fail((xhr) => {
      loading?.classList.add('hidden');
      if (xhr.status !== 401) {
        errorEl?.classList.remove('hidden');
        const desc = document.getElementById('error-message');
        if (desc) {
          desc.textContent = xhr.responseJSON?.message || 'Unable to retrieve notifications.';
        }
      }
    });
}

/**
 * Updates the unread count pill next to the page heading.
 */
function updateUnreadPill() {
  const pill = document.getElementById('unread-count-pill');
  if (!pill) return;

  const user = getUser();
  const readSet = getReadNotificationIds(user?.id);
  const unreadCount = allNotifications.filter((n) => !readSet.has(String(n.id))).length;

  if (unreadCount > 0) {
    pill.textContent = `${unreadCount} Unread`;
    pill.classList.remove('hidden');
  } else {
    pill.classList.add('hidden');
  }
}

/**
 * Filters and renders notification cards in the inbox.
 */
function renderNotifications() {
  const loading = document.getElementById('notifications-loading');
  const emptyEl = document.getElementById('notifications-empty');
  const listEl = document.getElementById('notifications-list');
  const emptyResetBtn = document.getElementById('empty-reset-btn');
  const emptyTitle = document.getElementById('empty-title');
  const emptyDesc = document.getElementById('empty-desc');

  loading?.classList.add('hidden');

  const user = getUser();
  const readSet = getReadNotificationIds(user?.id);
  const admin = isAdmin();

  const searchTerm = (document.getElementById('notif-search')?.value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('filter-status')?.value || 'all';
  const typeFilter = document.getElementById('filter-type')?.value || 'all';

  let filtered = allNotifications.filter((n) => {
    const isRead = readSet.has(String(n.id));

    // Status filter
    if (statusFilter === 'unread' && isRead) return false;
    if (statusFilter === 'read' && !isRead) return false;

    // Type filter
    if (typeFilter !== 'all' && (n.type || '').toLowerCase() !== typeFilter.toLowerCase()) {
      return false;
    }

    // Keyword search
    if (searchTerm) {
      const matchTitle = (n.title || '').toLowerCase().includes(searchTerm);
      const matchMsg = (n.message || '').toLowerCase().includes(searchTerm);
      return matchTitle || matchMsg;
    }

    return true;
  });

  if (filtered.length === 0) {
    listEl?.classList.add('hidden');
    emptyEl?.classList.remove('hidden');

    if (searchTerm || statusFilter !== 'all' || typeFilter !== 'all') {
      if (emptyTitle) emptyTitle.textContent = 'No Matching Notifications';
      if (emptyDesc) emptyDesc.textContent = 'No notifications match your current filter criteria.';
      if (emptyResetBtn) emptyResetBtn.classList.remove('hidden');
    } else {
      if (emptyTitle) emptyTitle.textContent = 'Inbox Zero!';
      if (emptyDesc) emptyDesc.textContent = 'You have no notifications in your inbox right now. When announcements or updates occur, they will appear here.';
      if (emptyResetBtn) emptyResetBtn.classList.add('hidden');
    }
    return;
  }

  emptyEl?.classList.add('hidden');
  listEl?.classList.remove('hidden');

  listEl.innerHTML = filtered.map((n) => {
    const isRead = readSet.has(String(n.id));
    const targetLink = resolveNotificationLink(n);
    const nType = (n.type || 'system').toLowerCase();

    // Type icon & style
    let typeIcon = `
      <svg class="w-4 h-4 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
      </svg>`;
    if (nType === 'announcement') {
      typeIcon = `
        <svg class="w-4 h-4 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z"/>
        </svg>`;
    } else if (nType === 'promo') {
      typeIcon = `
        <svg class="w-4 h-4 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"/>
        </svg>`;
    } else if (nType === 'event') {
      typeIcon = `
        <svg class="w-4 h-4 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>`;
    }

    const recipientTag = n.recipient_id === null
      ? '<span class="badge bg-blue-50 text-blue-700 text-[11px] font-medium px-2 py-0.5 rounded">Broadcast</span>'
      : '<span class="badge bg-purple-50 text-purple-700 text-[11px] font-medium px-2 py-0.5 rounded">Direct Notice</span>';

    const statusBadge = isRead
      ? '<span class="text-xs text-gray-400 font-normal">Read</span>'
      : '<span class="badge bg-teal/15 text-teal text-xs font-semibold px-2 py-0.5 rounded inline-flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-teal"></span>Unread</span>';

    // Link label
    let linkLabel = 'Open Related Content &rarr;';
    if (nType === 'announcement') linkLabel = 'Listen to Announcement &rarr;';
    else if (nType === 'promo') linkLabel = 'Watch Video Promotion &rarr;';
    else if (nType === 'event') linkLabel = 'View Event Details &rarr;';

    const linkButton = targetLink
      ? `<a href="${targetLink}"
            class="btn-primary text-xs py-1.5 px-3.5 inline-flex items-center gap-1.5 notif-link-action"
            data-id="${n.id}">
          ${linkLabel}
        </a>`
      : '';

    const readToggleBtn = isRead
      ? `<button type="button" class="btn-toggle-read text-xs text-gray-500 hover:text-teal font-medium px-2.5 py-1 rounded border border-gray-200 hover:border-gray-300 bg-white cursor-pointer" data-id="${n.id}" data-action="unread">Mark as Unread</button>`
      : `<button type="button" class="btn-toggle-read text-xs text-teal font-semibold px-2.5 py-1 rounded border border-teal/30 bg-soft-mint/40 hover:bg-soft-mint cursor-pointer" data-id="${n.id}" data-action="read">Mark as Read</button>`;

    const adminDeleteBtn = admin
      ? `<button type="button" class="btn-delete-notif text-xs text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded border border-red-200 cursor-pointer ml-auto" data-id="${n.id}" data-title="${escapeHtml(n.title)}">Delete</button>`
      : '';

    return `
      <article class="card p-5 sm:p-6 transition-all border ${isRead ? 'border-gray-200 bg-white/90' : 'border-teal/30 border-l-4 border-l-teal bg-soft-mint/10 shadow-xs'}" data-id="${n.id}">
        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-deep-teal font-heading">
              ${typeIcon}
              <span class="capitalize">${escapeHtml(nType)}</span>
            </span>
            ${recipientTag}
            ${statusBadge}
          </div>
          <div class="flex items-center gap-1 text-xs text-gray-400">
            <time datetime="${n.created_at}">${formatDateTime(n.created_at)}</time>
            <span>&bull;</span>
            <span>${timeAgo(n.created_at)}</span>
          </div>
        </div>

        <h2 class="text-base sm:text-lg font-heading font-bold text-deep-teal tracking-tight mb-2 ${isRead ? 'font-semibold text-gray-800' : 'font-extrabold text-deep-teal'}">
          ${escapeHtml(n.title)}
        </h2>

        <p class="text-sm text-gray-600 leading-relaxed mb-4">
          ${escapeHtml(n.message)}
        </p>

        <div class="pt-3 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-2 flex-wrap">
            ${linkButton}
            ${readToggleBtn}
          </div>
          ${adminDeleteBtn}
        </div>
      </article>
    `;
  }).join('');

  bindCardActionEvents();
}

/**
 * Attaches event listeners to rendered card actions.
 */
function bindCardActionEvents() {
  const user = getUser();
  const userId = user?.id;

  // Destination navigation links (mark as read on click)
  document.querySelectorAll('.notif-link-action').forEach((link) => {
    link.addEventListener('click', () => {
      const id = link.getAttribute('data-id');
      markAsRead(id, userId);
    });
  });

  // Toggle read status
  document.querySelectorAll('.btn-toggle-read').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      if (action === 'read') {
        markAsRead(id, userId);
      } else {
        markAsUnread(id, userId);
      }
    });
  });

  // Admin delete
  document.querySelectorAll('.btn-delete-notif').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      const title = btn.getAttribute('data-title');
      openDeleteModal(id, title, e.currentTarget);
    });
  });
}

/**
 * Binds search and filter controls.
 */
function bindFilterEvents() {
  const searchInput = document.getElementById('notif-search');
  const clearBtn = document.getElementById('search-clear-btn');
  const statusSelect = document.getElementById('filter-status');
  const typeSelect = document.getElementById('filter-type');
  const resetBtn = document.getElementById('empty-reset-btn');
  const retryBtn = document.getElementById('retry-btn');
  const markAllBtn = document.getElementById('mark-all-read-btn');

  searchInput?.addEventListener('input', () => {
    if (searchInput.value.trim().length > 0) {
      clearBtn?.classList.remove('hidden');
    } else {
      clearBtn?.classList.add('hidden');
    }
    renderNotifications();
  });

  clearBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    clearBtn.classList.add('hidden');
    searchInput?.focus();
    renderNotifications();
  });

  statusSelect?.addEventListener('change', renderNotifications);
  typeSelect?.addEventListener('change', renderNotifications);

  resetBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    clearBtn?.classList.add('hidden');
    if (statusSelect) statusSelect.value = 'all';
    if (typeSelect) typeSelect.value = 'all';
    renderNotifications();
  });

  retryBtn?.addEventListener('click', loadNotifications);

  markAllBtn?.addEventListener('click', () => {
    const user = getUser();
    const ids = allNotifications.map((n) => n.id);
    markAllAsRead(ids, user?.id);
    showToast('All notifications marked as read', 'success');
  });
}

/**
 * Opens delete confirmation modal for administrators.
 * @param {string} id
 * @param {string} title
 * @param {HTMLElement} [triggerEl]
 */
function openDeleteModal(id, title, triggerEl = null) {
  pendingDeleteId = id;
  const modal = document.getElementById('delete-modal');
  const desc = document.getElementById('delete-modal-desc');

  if (desc) {
    desc.textContent = `Are you sure you want to permanently delete "${title}"? This action cannot be reversed.`;
  }

  openModal(modal, triggerEl, '#cancel-delete-btn');
}

/**
 * Binds delete confirmation modal buttons.
 */
function bindModalEvents() {
  const modal = document.getElementById('delete-modal');
  const cancelBtn = document.getElementById('cancel-delete-btn');
  const confirmBtn = document.getElementById('confirm-delete-btn');

  const closeDeleteModal = () => {
    closeModal(modal);
    pendingDeleteId = null;
  };

  cancelBtn?.addEventListener('click', closeDeleteModal);
  setupModalA11y(modal, closeDeleteModal, true);

  confirmBtn?.addEventListener('click', () => {
    if (!pendingDeleteId) return;

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Deleting…';

    deleteNotification(pendingDeleteId)
      .done(() => {
        closeDeleteModal();
        showToast('Notification deleted successfully', 'success');
        loadNotifications();
      })
      .fail((xhr) => {
        const msg = xhr.responseJSON?.message || 'Failed to delete notification';
        showToast(msg, 'error');
      })
      .always(() => {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Yes, Delete';
      });
  });
}

// Bootstrap on DOM readiness
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

