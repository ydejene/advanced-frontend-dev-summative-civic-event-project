/**
 * Administrator Events Management Controller
 * Handles administrative CRUD workflows for community events:
 * - Listing events with thumbnails, location, and schedule
 * - Creating new events with optional multipart image upload (POST /api/events)
 * - Updating existing events with optional image replacement (PUT /api/events/:id)
 * - Deleting events with confirmation and foreign-key error handling (DELETE /api/events/:id)
 * - Accessible modal dialog management with scroll containment and focus restoration
 */
import { initShell } from '../../components.js';
import { requireAdmin } from '../../guards.js';
import api from '../../api.js';
import { formatDateTime, escapeHtml, truncate, showToast, getCategoryInfo } from '../../utils.js';

// Enforce administrative role before executing page logic
if (!requireAdmin()) {
  // requireAdmin automatically redirects unauthorized users
}

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB limit enforced by backend multer
const ALLOWED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif'];

let eventsList = [];
let pendingDeleteId = null;
let activeModal = null;
let lastFocusedTrigger = null;

/**
 * Initializes the Admin Events Management page.
 */
function init() {
  initShell('events');
  loadEvents();
  bindModalEvents();
  bindFormEvents();
}

/**
 * Loads all events from the backend API.
 */
function loadEvents() {
  const loading = document.getElementById('admin-loading');
  const emptyEl = document.getElementById('admin-empty');
  const tableContainer = document.getElementById('table-container');

  loading?.classList.remove('hidden');
  emptyEl?.classList.add('hidden');
  tableContainer?.classList.add('hidden');

  api.get('/events')
    .done((res) => {
      const items = Array.isArray(res?.data) ? res.data : [];
      // Sort upcoming events first
      items.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
      eventsList = items;
      renderTable(items);
    })
    .fail((xhr) => {
      loading?.classList.add('hidden');
      showAlert(xhr.responseJSON?.message || 'Failed to retrieve community events from the server.', 'error');
    });
}

/**
 * Renders event rows in the management table.
 * @param {Array} items
 */
function renderTable(items) {
  const loading = document.getElementById('admin-loading');
  const emptyEl = document.getElementById('admin-empty');
  const tableContainer = document.getElementById('table-container');
  const tbody = document.getElementById('events-tbody');

  loading?.classList.add('hidden');

  if (!items || items.length === 0) {
    emptyEl?.classList.remove('hidden');
    tableContainer?.classList.add('hidden');
    return;
  }

  emptyEl?.classList.add('hidden');
  tableContainer?.classList.remove('hidden');

  if (!tbody) return;

  tbody.innerHTML = items.map((e) => {
    const catInfo = getCategoryInfo(e);
    const imageUrl = e.metadata?.image_url || catInfo.image || catInfo.fallbackImage || '/assets/images/placeholder-event.svg';
    const startsFormatted = e.starts_at ? formatDateTime(e.starts_at) : 'TBD';
    const endsFormatted = e.ends_at ? formatDateTime(e.ends_at) : 'TBD';

    return `
      <tr class="hover:bg-gray-50/80 transition-colors" data-id="${e.id}">
        <td class="py-4 px-4 sm:px-6">
          <div class="flex items-center gap-3">
            <img src="${escapeHtml(imageUrl)}"
                 alt=""
                 onerror="this.src='/assets/images/placeholder-event.svg'"
                 class="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-gray-100 border border-gray-200">
            <div class="min-w-0">
              <a href="/pages/events/detail.html?id=${e.id}"
                 class="text-teal hover:text-deep-teal font-semibold hover:underline block leading-snug line-clamp-1"
                 title="View event details">
                ${escapeHtml(e.title)}
              </a>
              <p class="text-xs text-gray-500 line-clamp-1 mt-0.5">
                ${escapeHtml(truncate(e.description || 'No description provided.', 80))}
              </p>
            </div>
          </div>
        </td>
        <td class="py-4 px-4 sm:px-6 text-xs text-gray-700 whitespace-nowrap">
          <div class="flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <span class="truncate max-w-[180px]">${escapeHtml(e.location)}</span>
          </div>
        </td>
        <td class="py-4 px-4 sm:px-6 text-xs text-gray-700 whitespace-nowrap">
          ${startsFormatted}
        </td>
        <td class="py-4 px-4 sm:px-6 text-xs text-gray-700 whitespace-nowrap">
          ${endsFormatted}
        </td>
        <td class="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
          <div class="inline-flex items-center gap-2">
            <a href="/pages/events/detail.html?id=${e.id}"
               class="px-2.5 py-1 text-xs font-medium rounded border border-teal text-teal hover:bg-soft-mint transition cursor-pointer"
               title="View public details and rosters">
              View
            </a>
            <button type="button"
                    class="btn-edit-event px-2.5 py-1 text-xs font-medium rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition cursor-pointer"
                    data-id="${e.id}"
                    aria-label="Edit event ${escapeHtml(e.title)}">
              Edit
            </button>
            <button type="button"
                    class="btn-delete-event px-2.5 py-1 text-xs font-medium rounded text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition cursor-pointer"
                    data-id="${e.id}"
                    data-title="${escapeHtml(e.title)}"
                    aria-label="Delete event ${escapeHtml(e.title)}">
              Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  bindTableActionEvents();
}

/**
 * Attaches event listeners to dynamically rendered table action buttons.
 */
function bindTableActionEvents() {
  document.querySelectorAll('.btn-edit-event').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      openEditModal(id, e.currentTarget);
    });
  });

  document.querySelectorAll('.btn-delete-event').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      const title = btn.getAttribute('data-title');
      openDeleteModal(id, title, e.currentTarget);
    });
  });
}

/**
 * Converts ISO 8601 string to datetime-local input format (YYYY-MM-DDTHH:mm).
 * @param {string} isoString
 * @returns {string}
 */
function toDatetimeLocal(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const YYYY = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${YYYY}-${MM}-${DD}T${hh}:${mm}`;
}

/**
 * Accessible Modal Opening helper with scroll locking and focus management.
 * @param {HTMLElement} modalEl
 * @param {HTMLElement} [triggerEl]
 */
function openModal(modalEl, triggerEl) {
  if (!modalEl) return;
  lastFocusedTrigger = triggerEl || document.activeElement;
  activeModal = modalEl;
  document.body.classList.add('overflow-hidden');
  modalEl.classList.remove('hidden');

  // Focus the first interactive element or close button
  const focusable = modalEl.querySelector('input:not([type="hidden"]), textarea, select, button:not([disabled])');
  focusable?.focus();
}

/**
 * Traps Tab key focus inside the currently active modal dialog.
 * @param {HTMLElement} modalEl
 * @param {KeyboardEvent} e
 */
function trapFocus(modalEl, e) {
  if (e.key !== 'Tab') return;

  const focusables = Array.from(
    modalEl.querySelectorAll(
      'button:not([disabled]), input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => el.offsetParent !== null); // Ensure element is visible

  if (!focusables.length) return;

  const firstFocusable = focusables[0];
  const lastFocusable = focusables[focusables.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === firstFocusable || !modalEl.contains(document.activeElement)) {
      e.preventDefault();
      lastFocusable.focus();
    }
  } else {
    if (document.activeElement === lastFocusable || !modalEl.contains(document.activeElement)) {
      e.preventDefault();
      firstFocusable.focus();
    }
  }
}

/**
 * Accessible Modal Closing helper with scroll unlocking and focus restoration.
 * @param {HTMLElement} modalEl
 */
function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
  activeModal = null;
  lastFocusedTrigger?.focus();
  lastFocusedTrigger = null;
}

/**
 * Opens edit modal populated with existing record data.
 * @param {string} id
 * @param {HTMLElement} triggerEl
 */
function openEditModal(id, triggerEl) {
  const item = eventsList.find((e) => String(e.id) === String(id));
  if (!item) return;

  const modal = document.getElementById('edit-modal');
  const idInput = document.getElementById('edit-id');
  const titleInput = document.getElementById('edit-title');
  const locInput = document.getElementById('edit-location');
  const startsInput = document.getElementById('edit-starts-at');
  const endsInput = document.getElementById('edit-ends-at');
  const descInput = document.getElementById('edit-description');
  const fileInput = document.getElementById('edit-image');
  const errorEl = document.getElementById('edit-error');

  const currentImgContainer = document.getElementById('edit-current-image-container');
  const currentImgPreview = document.getElementById('edit-current-image-preview');

  if (idInput) idInput.value = item.id;
  if (titleInput) titleInput.value = item.title || '';
  if (locInput) locInput.value = item.location || '';
  if (startsInput) startsInput.value = toDatetimeLocal(item.starts_at);
  if (endsInput) endsInput.value = toDatetimeLocal(item.ends_at);
  if (descInput) descInput.value = item.description || '';
  if (fileInput) fileInput.value = '';

  const imgUrl = item.metadata?.image_url;
  if (imgUrl && currentImgContainer && currentImgPreview) {
    currentImgPreview.src = imgUrl;
    currentImgContainer.classList.remove('hidden');
  } else if (currentImgContainer) {
    currentImgContainer.classList.add('hidden');
  }

  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }

  openModal(modal, triggerEl);
  titleInput?.focus();
}

/**
 * Opens delete confirmation modal.
 * @param {string} id
 * @param {string} title
 * @param {HTMLElement} triggerEl
 */
function openDeleteModal(id, title, triggerEl) {
  pendingDeleteId = id;
  const modal = document.getElementById('delete-modal');
  const desc = document.getElementById('delete-modal-desc');
  const errorEl = document.getElementById('delete-error');

  if (desc) {
    desc.textContent = `Are you sure you want to permanently delete the event "${title}"? This action cannot be reversed.`;
  }
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }

  openModal(modal, triggerEl);
  // Default focus to safe cancel action
  document.getElementById('cancel-delete-btn')?.focus();
}

/**
 * Binds open/close modal triggers and backdrop/Escape listeners.
 */
function bindModalEvents() {
  const openCreateBtn = document.getElementById('open-create-modal-btn');
  const emptyCreateBtn = document.getElementById('empty-create-btn');
  const createModal = document.getElementById('create-modal');
  const closeCreateBtn = document.getElementById('close-create-modal');
  const cancelCreateBtn = document.getElementById('cancel-create-btn');

  const editModal = document.getElementById('edit-modal');
  const closeEditBtn = document.getElementById('close-edit-modal');
  const cancelEditBtn = document.getElementById('cancel-edit-btn');

  const deleteModal = document.getElementById('delete-modal');
  const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
  const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

  const alertClose = document.getElementById('admin-alert-close');

  const openCreate = (e) => {
    document.getElementById('create-event-form')?.reset();
    document.getElementById('create-error')?.classList.add('hidden');
    openModal(createModal, e.currentTarget);
    document.getElementById('create-title')?.focus();
  };

  openCreateBtn?.addEventListener('click', openCreate);
  emptyCreateBtn?.addEventListener('click', openCreate);

  closeCreateBtn?.addEventListener('click', () => closeModal(createModal));
  cancelCreateBtn?.addEventListener('click', () => closeModal(createModal));

  closeEditBtn?.addEventListener('click', () => closeModal(editModal));
  cancelEditBtn?.addEventListener('click', () => closeModal(editModal));

  cancelDeleteBtn?.addEventListener('click', () => {
    closeModal(deleteModal);
    pendingDeleteId = null;
  });

  // Backdrop click dismissal
  [createModal, editModal, deleteModal].forEach((modal) => {
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal);
        if (modal === deleteModal) pendingDeleteId = null;
      }
    });
  });

  // Global Escape key and Focus Trap handler
  document.addEventListener('keydown', (e) => {
    if (!activeModal) return;

    if (e.key === 'Escape') {
      const modalToClose = activeModal;
      closeModal(modalToClose);
      if (modalToClose === deleteModal) pendingDeleteId = null;
      return;
    }

    if (e.key === 'Tab') {
      trapFocus(activeModal, e);
    }
  });

  // Deletion execution with foreign-key constraint protection
  confirmDeleteBtn?.addEventListener('click', () => {
    if (!pendingDeleteId) return;

    const errorEl = document.getElementById('delete-error');
    if (errorEl) errorEl.classList.add('hidden');

    confirmDeleteBtn.disabled = true;
    confirmDeleteBtn.textContent = 'Deleting…';

    api.delete(`/events/${encodeURIComponent(pendingDeleteId)}`)
      .done(() => {
        closeModal(deleteModal);
        pendingDeleteId = null;
        showToast('Event deleted successfully.', 'success');
        loadEvents();
      })
      .fail((xhr) => {
        let msg = xhr.responseJSON?.message || 'Failed to delete event.';
        // Check for foreign key integrity error
        if (xhr.status === 500 || xhr.status === 400 || (xhr.responseText && xhr.responseText.includes('foreign key'))) {
          msg = 'Cannot delete this event: Attendees have already registered. Delete or cancel registrations before removing the event.';
        }
        if (errorEl) {
          errorEl.textContent = msg;
          errorEl.classList.remove('hidden');
        } else {
          showAlert(msg, 'error');
        }
      })
      .always(() => {
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.textContent = 'Yes, Delete';
      });
  });

  alertClose?.addEventListener('click', () => {
    document.getElementById('admin-alert')?.classList.add('hidden');
  });
}

/**
 * Validates image file extension and size (max 2MB, jpg/png/gif).
 * @param {File} file
 * @returns {string|null} Error string if invalid, null if valid.
 */
function validateImageFile(file) {
  if (!file) return null;

  const fileName = file.name.toLowerCase();
  const validExt = ALLOWED_IMAGE_EXTS.some((ext) => fileName.endsWith(ext));
  if (!validExt) {
    return 'Invalid file format. Allowed extensions: ' + ALLOWED_IMAGE_EXTS.join(', ');
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return `Image file exceeds maximum limit of 2 MB (selected: ${(file.size / (1024 * 1024)).toFixed(2)} MB).`;
  }

  return null;
}

/**
 * Binds form submissions for creating and editing events.
 */
function bindFormEvents() {
  const createForm = document.getElementById('create-event-form');
  const editForm = document.getElementById('edit-event-form');

  createForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    handleCreateSubmit();
  });

  editForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    handleEditSubmit();
  });
}

/**
 * Handles creation of new event with multipart data.
 */
function handleCreateSubmit() {
  const title = (document.getElementById('create-title')?.value || '').trim();
  const location = (document.getElementById('create-location')?.value || '').trim();
  const startsAt = document.getElementById('create-starts-at')?.value;
  const endsAt = document.getElementById('create-ends-at')?.value;
  const description = (document.getElementById('create-description')?.value || '').trim();
  const fileInput = document.getElementById('create-image');
  const errorEl = document.getElementById('create-error');
  const submitBtn = document.getElementById('submit-create-btn');

  // Client validation
  if (!title) {
    showModalError(errorEl, 'Event title is required.');
    return;
  }
  if (!location) {
    showModalError(errorEl, 'Event location is required.');
    return;
  }
  if (!startsAt) {
    showModalError(errorEl, 'Start date and time are required.');
    return;
  }
  if (!endsAt) {
    showModalError(errorEl, 'End date and time are required.');
    return;
  }

  const startDate = new Date(startsAt);
  const endDate = new Date(endsAt);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    showModalError(errorEl, 'Please enter valid start and end dates and times.');
    return;
  }
  if (endDate <= startDate) {
    showModalError(errorEl, 'End date and time must be after the start date and time.');
    return;
  }

  const file = fileInput?.files?.[0];
  if (file) {
    const fileError = validateImageFile(file);
    if (fileError) {
      showModalError(errorEl, fileError);
      return;
    }
  }

  errorEl?.classList.add('hidden');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Publishing Event…';
  }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('location', location);
  formData.append('starts_at', startDate.toISOString());
  formData.append('ends_at', endDate.toISOString());
  if (description) formData.append('description', description);
  if (file) formData.append('image', file);

  api.upload('/events', formData)
    .done(() => {
      closeModal(document.getElementById('create-modal'));
      showToast('Event created and broadcast notification sent!', 'success');
      loadEvents();
    })
    .fail((xhr) => {
      const msg = xhr.responseJSON?.message || xhr.responseJSON?.errors?.[0]?.msg || 'Failed to create event.';
      showModalError(errorEl, msg);
    })
    .always(() => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Publish Event';
      }
    });
}

/**
 * Handles updating of existing event with multipart data.
 */
function handleEditSubmit() {
  const id = document.getElementById('edit-id')?.value;
  const title = (document.getElementById('edit-title')?.value || '').trim();
  const location = (document.getElementById('edit-location')?.value || '').trim();
  const startsAt = document.getElementById('edit-starts-at')?.value;
  const endsAt = document.getElementById('edit-ends-at')?.value;
  const description = (document.getElementById('edit-description')?.value || '').trim();
  const fileInput = document.getElementById('edit-image');
  const errorEl = document.getElementById('edit-error');
  const submitBtn = document.getElementById('submit-edit-btn');

  if (!id) return;

  // Client validation
  if (!title) {
    showModalError(errorEl, 'Event title is required.');
    return;
  }
  if (!location) {
    showModalError(errorEl, 'Event location is required.');
    return;
  }
  if (!startsAt) {
    showModalError(errorEl, 'Start date and time are required.');
    return;
  }
  if (!endsAt) {
    showModalError(errorEl, 'End date and time are required.');
    return;
  }

  const startDate = new Date(startsAt);
  const endDate = new Date(endsAt);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    showModalError(errorEl, 'Please enter valid start and end dates and times.');
    return;
  }
  if (endDate <= startDate) {
    showModalError(errorEl, 'End date and time must be after the start date and time.');
    return;
  }

  const file = fileInput?.files?.[0];
  if (file) {
    const fileError = validateImageFile(file);
    if (fileError) {
      showModalError(errorEl, fileError);
      return;
    }
  }

  errorEl?.classList.add('hidden');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving Changes…';
  }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('location', location);
  formData.append('starts_at', startDate.toISOString());
  formData.append('ends_at', endDate.toISOString());
  formData.append('description', description);
  if (file) formData.append('image', file);

  api.uploadPut(`/events/${encodeURIComponent(id)}`, formData)
    .done(() => {
      closeModal(document.getElementById('edit-modal'));
      showToast('Event updated successfully.', 'success');
      loadEvents();
    })
    .fail((xhr) => {
      const msg = xhr.responseJSON?.message || xhr.responseJSON?.errors?.[0]?.msg || 'Failed to update event.';
      showModalError(errorEl, msg);
    })
    .always(() => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
      }
    });
}

/**
 * Displays error inside modal dialog.
 * @param {HTMLElement} el
 * @param {string} msg
 */
function showModalError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
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

