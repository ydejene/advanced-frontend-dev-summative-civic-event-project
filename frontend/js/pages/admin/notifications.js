/**
 * Administrator Notifications Management Controller
 * Handles administrative inspection of system broadcasts and direct notices,
 * audience tracking, destination validation, and notification deletion.
 */
import { initShell } from '../../components.js';
import { requireAdmin } from '../../guards.js';
import {
  fetchNotifications,
  deleteNotification,
  resolveNotificationLink
} from '../../notifications.js';
import { formatDateTime, escapeHtml, showToast, truncate } from '../../utils.js';

// Enforce admin authorization
if (!requireAdmin()) {
  // If unauthorized, requireAdmin redirects immediately
}

let allNotifications = [];
let pendingDeleteId = null;

/**
 * Initializes the Admin Notifications page.
 */
function init() {
  initShell('notifications');
  loadNotifications();
  bindModalEvents();
}

/**
 * Loads all notifications from the backend API.
 */
function loadNotifications() {
  const loading = document.getElementById('admin-loading');
  const emptyEl = document.getElementById('admin-empty');
  const tableContainer = document.getElementById('table-container');

  loading?.classList.remove('hidden');
  emptyEl?.classList.add('hidden');
  tableContainer?.classList.add('hidden');

  fetchNotifications()
    .done((res) => {
      const items = Array.isArray(res?.data) ? res.data : [];
      allNotifications = items;
      renderTable(items);
    })
    .fail((xhr) => {
      loading?.classList.add('hidden');
      showAlert(xhr.responseJSON?.message || 'Failed to load notifications', 'error');
    });
}

/**
 * Renders notification records in the admin table.
 * @param {Array} items
 */
function renderTable(items) {
  const loading = document.getElementById('admin-loading');
  const emptyEl = document.getElementById('admin-empty');
  const tableContainer = document.getElementById('table-container');
  const tbody = document.getElementById('notifications-tbody');

  loading?.classList.add('hidden');

  if (!items || items.length === 0) {
    emptyEl?.classList.remove('hidden');
    tableContainer?.classList.add('hidden');
    return;
  }

  emptyEl?.classList.add('hidden');
  tableContainer?.classList.remove('hidden');

  if (!tbody) return;

  tbody.innerHTML = items.map((n) => {
    const isBroadcast = n.recipient_id === null;
    const audienceBadge = isBroadcast
      ? '<span class="badge bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded">Public Broadcast</span>'
      : '<span class="badge bg-purple-50 text-purple-700 text-xs font-semibold px-2 py-0.5 rounded">Admin Direct Notice</span>';

    const typeBadge = `<span class="badge bg-soft-mint text-deep-teal text-xs font-semibold px-2 py-0.5 rounded capitalize">${escapeHtml(n.type || 'system')}</span>`;

    const targetLink = resolveNotificationLink(n);
    const linkDisplay = targetLink
      ? `<a href="${targetLink}" class="text-teal hover:text-deep-teal font-medium text-xs hover:underline inline-flex items-center gap-1">View Resource &rarr;</a>`
      : '<span class="text-xs text-gray-400">None</span>';

    return `
      <tr class="hover:bg-gray-50/80 transition-colors" data-id="${n.id}">
        <td class="py-4 px-4 sm:px-6 max-w-sm">
          <div class="font-semibold text-gray-900 leading-snug">
            ${escapeHtml(n.title)}
          </div>
          <p class="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
            ${escapeHtml(n.message)}
          </p>
        </td>
        <td class="py-4 px-4 sm:px-6 whitespace-nowrap">
          ${typeBadge}
        </td>
        <td class="py-4 px-4 sm:px-6 whitespace-nowrap">
          ${audienceBadge}
        </td>
        <td class="py-4 px-4 sm:px-6 whitespace-nowrap">
          ${linkDisplay}
        </td>
        <td class="py-4 px-4 sm:px-6 whitespace-nowrap text-xs text-gray-500">
          ${formatDateTime(n.created_at)}
        </td>
        <td class="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
          <button type="button"
                  class="btn-delete-notif px-2.5 py-1 text-xs font-medium rounded text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 cursor-pointer"
                  data-id="${n.id}"
                  data-title="${escapeHtml(n.title)}">
            Delete
          </button>
        </td>
      </tr>
    `;
  }).join('');

  bindTableActionEvents();
}

/**
 * Attaches event listeners to rendered delete action buttons.
 */
function bindTableActionEvents() {
  document.querySelectorAll('.btn-delete-notif').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const title = btn.getAttribute('data-title');
      openDeleteModal(id, title);
    });
  });
}

/**
 * Opens delete confirmation modal.
 * @param {string} id
 * @param {string} title
 */
function openDeleteModal(id, title) {
  pendingDeleteId = id;
  const modal = document.getElementById('delete-modal');
  const desc = document.getElementById('delete-modal-desc');

  if (desc) {
    desc.textContent = `Are you sure you want to permanently delete the notification "${title}"? If this is a broadcast bulletin, it will be deleted for all users.`;
  }

  modal?.classList.remove('hidden');
}

/**
 * Binds modal button events.
 */
function bindModalEvents() {
  const modal = document.getElementById('delete-modal');
  const cancelBtn = document.getElementById('cancel-delete-btn');
  const confirmBtn = document.getElementById('confirm-delete-btn');
  const alertClose = document.getElementById('admin-alert-close');

  const closeModal = () => {
    modal?.classList.add('hidden');
    pendingDeleteId = null;
  };

  cancelBtn?.addEventListener('click', closeModal);

  confirmBtn?.addEventListener('click', () => {
    if (!pendingDeleteId) return;

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Deleting…';

    deleteNotification(pendingDeleteId)
      .done(() => {
        closeModal();
        showToast('Notification deleted successfully', 'success');
        loadNotifications();
      })
      .fail((xhr) => {
        showAlert(xhr.responseJSON?.message || 'Failed to delete notification', 'error');
      })
      .always(() => {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Yes, Delete';
      });
  });

  alertClose?.addEventListener('click', () => {
    document.getElementById('admin-alert')?.classList.add('hidden');
  });
}

/**
 * Displays a dismissible alert banner on the page.
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

