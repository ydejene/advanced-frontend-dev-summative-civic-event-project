/**
 * Administrator Announcements Management Controller
 * Handles administrative CRUD workflows for voice announcements, audio file uploads,
 * publishing status toggles, and deletion confirmations.
 */
import { initShell } from '../../components.js';
import { requireAdmin } from '../../guards.js';
import api from '../../api.js';
import { formatDate, escapeHtml, showToast, openModal, closeModal, setupModalA11y } from '../../utils.js';

// Enforce role-based access before rendering
if (!requireAdmin()) {
  // If unauthorized, requireAdmin redirects immediately
}

const MAX_AUDIO_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_AUDIO_EXTS = ['.mp3', '.wav', '.m4a', '.ogg'];

let announcements = [];
let pendingDeleteId = null;

/**
 * Initializes the Admin Announcements page.
 */
function init() {
  initShell('announcements');
  loadAnnouncements();
  bindModalEvents();
  bindFormEvents();
}

/**
 * Fetches all announcements from the backend API.
 */
function loadAnnouncements() {
  const loading = document.getElementById('admin-loading');
  const emptyEl = document.getElementById('admin-empty');
  const tableContainer = document.getElementById('table-container');

  loading?.classList.remove('hidden');
  emptyEl?.classList.add('hidden');
  tableContainer?.classList.add('hidden');

  api.get('/announcements')
    .done((res) => {
      const items = Array.isArray(res?.data) ? res.data : [];
      announcements = items;
      renderTable(items);
    })
    .fail((xhr) => {
      loading?.classList.add('hidden');
      showAlert(xhr.responseJSON?.message || 'Failed to load announcements', 'error');
    });
}

/**
 * Renders announcement rows in the management table.
 * @param {Array} items
 */
function renderTable(items) {
  const loading = document.getElementById('admin-loading');
  const emptyEl = document.getElementById('admin-empty');
  const tableContainer = document.getElementById('table-container');
  const tbody = document.getElementById('announcements-tbody');

  loading?.classList.add('hidden');

  if (!items || items.length === 0) {
    emptyEl?.classList.remove('hidden');
    tableContainer?.classList.add('hidden');
    return;
  }

  emptyEl?.classList.add('hidden');
  tableContainer?.classList.remove('hidden');

  if (!tbody) return;

  tbody.innerHTML = items.map((a) => {
    const isPublished = Boolean(a.published);
    const statusBadge = isPublished
      ? '<span class="badge bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5 rounded">Published</span>'
      : '<span class="badge bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded">Draft</span>';

    const publishToggleLabel = isPublished ? 'Unpublish' : 'Publish';

    return `
      <tr class="hover:bg-gray-50/80 transition-colors" data-id="${a.id}">
        <td class="py-4 px-4 sm:px-6 font-medium text-gray-900 max-w-xs">
          <a href="/pages/announcements/detail.html?id=${a.id}" class="text-teal hover:text-deep-teal font-semibold hover:underline">
            ${escapeHtml(a.title)}
          </a>
        </td>
        <td class="py-4 px-4 sm:px-6">
          <audio controls preload="none" class="h-8 w-44 sm:w-52">
            <source src="${escapeHtml(a.audio_url)}" type="audio/mpeg">
            No audio
          </audio>
        </td>
        <td class="py-4 px-4 sm:px-6 whitespace-nowrap">
          ${statusBadge}
        </td>
        <td class="py-4 px-4 sm:px-6 whitespace-nowrap text-gray-500 text-xs">
          ${formatDate(a.created_at)}
        </td>
        <td class="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
          <div class="inline-flex items-center gap-2">
            <button type="button"
                    class="btn-toggle-publish px-2.5 py-1 text-xs font-medium rounded border ${isPublished ? 'border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100' : 'border-green-300 text-green-800 bg-green-50 hover:bg-green-100'} cursor-pointer"
                    data-id="${a.id}"
                    data-published="${isPublished}">
              ${publishToggleLabel}
            </button>
            <button type="button"
                    class="btn-edit-announcement px-2.5 py-1 text-xs font-medium rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                    data-id="${a.id}">
              Edit
            </button>
            <button type="button"
                    class="btn-delete-announcement px-2.5 py-1 text-xs font-medium rounded text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 cursor-pointer"
                    data-id="${a.id}"
                    data-title="${escapeHtml(a.title)}">
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
 * Attaches event listeners to dynamically rendered table buttons.
 */
function bindTableActionEvents() {
  // Toggle publish
  document.querySelectorAll('.btn-toggle-publish').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const isPublished = btn.getAttribute('data-published') === 'true';
      togglePublishStatus(id, isPublished);
    });
  });

  // Edit announcement
  document.querySelectorAll('.btn-edit-announcement').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      openEditModal(id, e.currentTarget);
    });
  });

  // Delete announcement
  document.querySelectorAll('.btn-delete-announcement').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      const title = btn.getAttribute('data-title');
      openDeleteModal(id, title, e.currentTarget);
    });
  });
}

/**
 * Handles publish / unpublish toggle for an announcement.
 * @param {string} id
 * @param {boolean} currentPublished
 */
function togglePublishStatus(id, currentPublished) {
  const endpoint = currentPublished
    ? `/announcements/${id}/unpublish`
    : `/announcements/${id}/publish`;

  api.patch(endpoint, {})
    .done(() => {
      showToast(`Announcement ${currentPublished ? 'unpublished' : 'published'} successfully`, 'success');
      loadAnnouncements();
    })
    .fail((xhr) => {
      showAlert(xhr.responseJSON?.message || 'Failed to update publication status', 'error');
    });
}

/**
 * Opens edit modal populated with existing record data.
 * @param {string} id
 * @param {HTMLElement} [triggerEl]
 */
function openEditModal(id, triggerEl = null) {
  const item = announcements.find((a) => String(a.id) === String(id));
  if (!item) return;

  const modal = document.getElementById('edit-modal');
  const idInput = document.getElementById('edit-id');
  const titleInput = document.getElementById('edit-title');
  const audioInput = document.getElementById('edit-audio');
  const publishedCheckbox = document.getElementById('edit-published');
  const errorEl = document.getElementById('edit-error');

  if (idInput) idInput.value = item.id;
  if (titleInput) titleInput.value = item.title;
  if (audioInput) audioInput.value = '';
  if (publishedCheckbox) publishedCheckbox.checked = Boolean(item.published);
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }

  openModal(modal, triggerEl, '#edit-title');
}

/**
 * Opens delete confirmation modal.
 * @param {string} id
 * @param {string} title
 * @param {HTMLElement} [triggerEl]
 */
function openDeleteModal(id, title, triggerEl = null) {
  pendingDeleteId = id;
  const modal = document.getElementById('delete-modal');
  const desc = document.getElementById('delete-modal-desc');

  if (desc) {
    desc.textContent = `Are you sure you want to permanently delete the announcement "${title}"? This action cannot be reversed.`;
  }

  openModal(modal, triggerEl, '#cancel-delete-btn');
}

/**
 * Binds open/close modal triggers.
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
    document.getElementById('create-announcement-form')?.reset();
    document.getElementById('create-error')?.classList.add('hidden');
    openModal(createModal, e?.currentTarget, '#create-title');
  };

  const closeCreate = () => closeModal(createModal);
  const closeEdit = () => closeModal(editModal);
  const closeDelete = () => {
    closeModal(deleteModal);
    pendingDeleteId = null;
  };

  openCreateBtn?.addEventListener('click', openCreate);
  emptyCreateBtn?.addEventListener('click', openCreate);

  closeCreateBtn?.addEventListener('click', closeCreate);
  cancelCreateBtn?.addEventListener('click', closeCreate);

  closeEditBtn?.addEventListener('click', closeEdit);
  cancelEditBtn?.addEventListener('click', closeEdit);

  cancelDeleteBtn?.addEventListener('click', closeDelete);

  setupModalA11y(createModal, closeCreate, true);
  setupModalA11y(editModal, closeEdit, true);
  setupModalA11y(deleteModal, closeDelete, true);

  confirmDeleteBtn?.addEventListener('click', () => {
    if (!pendingDeleteId) return;

    confirmDeleteBtn.disabled = true;
    confirmDeleteBtn.textContent = 'Deleting…';

    api.delete(`/announcements/${pendingDeleteId}`)
      .done(() => {
        closeDelete();
        showToast('Announcement deleted successfully', 'success');
        loadAnnouncements();
      })
      .fail((xhr) => {
        showAlert(xhr.responseJSON?.message || 'Failed to delete announcement', 'error');
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
 * Binds form submissions for create and edit.
 */
function bindFormEvents() {
  const createForm = document.getElementById('create-announcement-form');
  const editForm = document.getElementById('edit-announcement-form');

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
 * Validates audio file extension and size.
 * @param {File} file
 * @returns {string|null} Error string if invalid, null if valid.
 */
function validateAudioFile(file) {
  if (!file) return 'Audio file is required.';

  const fileName = file.name.toLowerCase();
  const validExt = ALLOWED_AUDIO_EXTS.some((ext) => fileName.endsWith(ext));
  if (!validExt) {
    return 'Invalid file format. Allowed extensions: ' + ALLOWED_AUDIO_EXTS.join(', ');
  }

  if (file.size > MAX_AUDIO_BYTES) {
    return `Audio file exceeds maximum size limit of 5 MB (selected: ${(file.size / (1024 * 1024)).toFixed(2)} MB).`;
  }

  return null;
}

/**
 * Submits new announcement with multipart audio file upload.
 */
function handleCreateSubmit() {
  const title = (document.getElementById('create-title')?.value || '').trim();
  const fileInput = document.getElementById('create-audio');
  const published = document.getElementById('create-published')?.checked;
  const errorEl = document.getElementById('create-error');
  const submitBtn = document.getElementById('submit-create-btn');

  if (!title) {
    if (errorEl) {
      errorEl.textContent = 'Announcement title is required.';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  const file = fileInput?.files?.[0];
  const fileError = validateAudioFile(file);
  if (fileError) {
    if (errorEl) {
      errorEl.textContent = fileError;
      errorEl.classList.remove('hidden');
    }
    return;
  }

  errorEl?.classList.add('hidden');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading & Creating…';
  }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('audio', file);
  formData.append('published', published ? 'true' : 'false');

  api.upload('/announcements', formData)
    .done(() => {
      closeModal(document.getElementById('create-modal'));
      showToast('Announcement created and broadcasted successfully', 'success');
      loadAnnouncements();
    })
    .fail((xhr) => {
      if (errorEl) {
        errorEl.textContent = xhr.responseJSON?.message || 'Failed to create announcement';
        errorEl.classList.remove('hidden');
      }
    })
    .always(() => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Announcement';
      }
    });
}

/**
 * Submits announcement update (optional audio replacement).
 */
function handleEditSubmit() {
  const id = document.getElementById('edit-id')?.value;
  const title = (document.getElementById('edit-title')?.value || '').trim();
  const fileInput = document.getElementById('edit-audio');
  const published = document.getElementById('edit-published')?.checked;
  const errorEl = document.getElementById('edit-error');
  const submitBtn = document.getElementById('submit-edit-btn');

  if (!id || !title) {
    if (errorEl) {
      errorEl.textContent = 'Announcement title is required.';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('published', published ? 'true' : 'false');

  const file = fileInput?.files?.[0];
  if (file) {
    const fileError = validateAudioFile(file);
    if (fileError) {
      if (errorEl) {
        errorEl.textContent = fileError;
        errorEl.classList.remove('hidden');
      }
      return;
    }
    formData.append('audio', file);
  }

  errorEl?.classList.add('hidden');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving Changes…';
  }

  api.put(`/announcements/${id}`, formData)
    .done(() => {
      closeModal(document.getElementById('edit-modal'));
      showToast('Announcement updated successfully', 'success');
      loadAnnouncements();
    })
    .fail((xhr) => {
      if (errorEl) {
        errorEl.textContent = xhr.responseJSON?.message || 'Failed to update announcement';
        errorEl.classList.remove('hidden');
      }
    })
    .always(() => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
      }
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

// Bootstrap once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

