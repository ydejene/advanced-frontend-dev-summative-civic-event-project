/**
 * Administrator Promotions Management Controller
 * Handles administrative CRUD workflows for civic video promotions, video file uploads,
 * closed captions management, publishing toggles, and deletion confirmations.
 */
import { initShell } from '../../components.js';
import { requireAdmin } from '../../guards.js';
import api from '../../api.js';
import { formatDate, escapeHtml, showToast, truncate, openModal, closeModal, setupModalA11y } from '../../utils.js';

// Enforce role-based access before rendering
if (!requireAdmin()) {
  // If unauthorized, requireAdmin redirects immediately
}

const MAX_VIDEO_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.mkv'];

let promos = [];
let pendingDeleteId = null;

/**
 * Initializes the Admin Promotions page.
 */
function init() {
  initShell('promotions');
  loadPromos();
  bindModalEvents();
  bindFormEvents();
}

/**
 * Fetches all promotions from the backend API.
 */
function loadPromos() {
  const loading = document.getElementById('admin-loading');
  const emptyEl = document.getElementById('admin-empty');
  const tableContainer = document.getElementById('table-container');

  loading?.classList.remove('hidden');
  emptyEl?.classList.add('hidden');
  tableContainer?.classList.add('hidden');

  api.get('/promos?limit=100')
    .done((res) => {
      const items = Array.isArray(res?.data) ? res.data : [];
      promos = items;
      renderTable(items);
    })
    .fail((xhr) => {
      loading?.classList.add('hidden');
      showAlert(xhr.responseJSON?.message || 'Failed to load promotions', 'error');
    });
}

/**
 * Renders promotion rows in the management table.
 * @param {Array} items
 */
function renderTable(items) {
  const loading = document.getElementById('admin-loading');
  const emptyEl = document.getElementById('admin-empty');
  const tableContainer = document.getElementById('table-container');
  const tbody = document.getElementById('promos-tbody');

  loading?.classList.add('hidden');

  if (!items || items.length === 0) {
    emptyEl?.classList.remove('hidden');
    tableContainer?.classList.add('hidden');
    return;
  }

  emptyEl?.classList.add('hidden');
  tableContainer?.classList.remove('hidden');

  if (!tbody) return;

  tbody.innerHTML = items.map((p) => {
    const isPublished = Boolean(p.published);
    const statusBadge = isPublished
      ? '<span class="badge bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5 rounded">Published</span>'
      : '<span class="badge bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded">Draft</span>';

    const publishToggleLabel = isPublished ? 'Unpublish' : 'Publish';

    const hasCaptions = Boolean(p.caption_text && p.caption_text.trim());
    const captionBadge = hasCaptions
      ? '<span class="badge bg-soft-mint text-deep-teal text-xs font-medium px-2 py-0.5 rounded">Present</span>'
      : '<span class="badge bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded">Missing</span>';

    return `
      <tr class="hover:bg-gray-50/80 transition-colors" data-id="${p.id}">
        <td class="py-4 px-4 sm:px-6 font-medium text-gray-900 max-w-xs">
          <a href="/pages/promotions/detail.html?id=${p.id}" class="text-teal hover:text-deep-teal font-semibold hover:underline block truncate">
            ${escapeHtml(p.title)}
          </a>
          <p class="text-xs text-gray-500 truncate mt-0.5">${escapeHtml(truncate(p.description, 60))}</p>
        </td>
        <td class="py-4 px-4 sm:px-6">
          <video preload="none" controls class="h-12 w-20 bg-black rounded object-contain">
            <source src="${escapeHtml(p.video_url)}" type="video/mp4">
            No video
          </video>
        </td>
        <td class="py-4 px-4 sm:px-6 whitespace-nowrap">
          ${captionBadge}
        </td>
        <td class="py-4 px-4 sm:px-6 whitespace-nowrap">
          ${statusBadge}
        </td>
        <td class="py-4 px-4 sm:px-6 whitespace-nowrap text-gray-500 text-xs">
          ${formatDate(p.created_at)}
        </td>
        <td class="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
          <div class="inline-flex items-center gap-2">
            <button type="button"
                    class="btn-toggle-publish px-2.5 py-1 text-xs font-medium rounded border ${isPublished ? 'border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100' : 'border-green-300 text-green-800 bg-green-50 hover:bg-green-100'} cursor-pointer"
                    data-id="${p.id}"
                    data-published="${isPublished}">
              ${publishToggleLabel}
            </button>
            <button type="button"
                    class="btn-edit-promo px-2.5 py-1 text-xs font-medium rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                    data-id="${p.id}">
              Edit
            </button>
            <button type="button"
                    class="btn-delete-promo px-2.5 py-1 text-xs font-medium rounded text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 cursor-pointer"
                    data-id="${p.id}"
                    data-title="${escapeHtml(p.title)}">
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

  // Edit promo
  document.querySelectorAll('.btn-edit-promo').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      openEditModal(id, e.currentTarget);
    });
  });

  // Delete promo
  document.querySelectorAll('.btn-delete-promo').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      const title = btn.getAttribute('data-title');
      openDeleteModal(id, title, e.currentTarget);
    });
  });
}

/**
 * Handles publish / unpublish toggle for a promo.
 * @param {string} id
 * @param {boolean} currentPublished
 */
function togglePublishStatus(id, currentPublished) {
  const endpoint = currentPublished
    ? `/promos/${id}/unpublish`
    : `/promos/${id}/publish`;

  api.patch(endpoint, {})
    .done(() => {
      showToast(`Promotion ${currentPublished ? 'unpublished' : 'published'} successfully`, 'success');
      loadPromos();
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
  const item = promos.find((p) => String(p.id) === String(id));
  if (!item) return;

  const modal = document.getElementById('edit-modal');
  const idInput = document.getElementById('edit-id');
  const titleInput = document.getElementById('edit-title');
  const descInput = document.getElementById('edit-description');
  const captionsInput = document.getElementById('edit-captions');
  const videoInput = document.getElementById('edit-video');
  const publishedCheckbox = document.getElementById('edit-published');
  const errorEl = document.getElementById('edit-error');

  if (idInput) idInput.value = item.id;
  if (titleInput) titleInput.value = item.title;
  if (descInput) descInput.value = item.description || '';
  if (captionsInput) captionsInput.value = item.caption_text || '';
  if (videoInput) videoInput.value = '';
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
    desc.textContent = `Are you sure you want to permanently delete the promotion "${title}"? This action cannot be reversed.`;
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
    document.getElementById('create-promo-form')?.reset();
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

    api.delete(`/promos/${pendingDeleteId}`)
      .done(() => {
        closeDelete();
        showToast('Promotion deleted successfully', 'success');
        loadPromos();
      })
      .fail((xhr) => {
        showAlert(xhr.responseJSON?.message || 'Failed to delete promotion', 'error');
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
  const createForm = document.getElementById('create-promo-form');
  const editForm = document.getElementById('edit-promo-form');

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
 * Validates video file extension and size.
 * @param {File} file
 * @returns {string|null} Error message if invalid, null if valid.
 */
function validateVideoFile(file) {
  if (!file) return 'Video file is required.';

  const fileName = file.name.toLowerCase();
  const validExt = ALLOWED_VIDEO_EXTS.some((ext) => fileName.endsWith(ext));
  if (!validExt) {
    return 'Invalid video format. Allowed extensions: ' + ALLOWED_VIDEO_EXTS.join(', ');
  }

  if (file.size > MAX_VIDEO_BYTES) {
    return `Video file exceeds maximum size limit of 8 MB (selected: ${(file.size / (1024 * 1024)).toFixed(2)} MB).`;
  }

  return null;
}

/**
 * Submits new promotion with multipart video file upload.
 */
function handleCreateSubmit() {
  const title = (document.getElementById('create-title')?.value || '').trim();
  const description = (document.getElementById('create-description')?.value || '').trim();
  const captionText = (document.getElementById('create-captions')?.value || '').trim();
  const fileInput = document.getElementById('create-video');
  const errorEl = document.getElementById('create-error');
  const submitBtn = document.getElementById('submit-create-btn');

  if (!title || !description || !captionText) {
    if (errorEl) {
      errorEl.textContent = 'Title, description, and captions are all required fields.';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  const file = fileInput?.files?.[0];
  const fileError = validateVideoFile(file);
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
  formData.append('description', description);
  formData.append('caption_text', captionText);
  formData.append('video', file);

  api.upload('/promos', formData)
    .done(() => {
      closeModal(document.getElementById('create-modal'));
      showToast('Promotion created successfully', 'success');
      loadPromos();
    })
    .fail((xhr) => {
      if (errorEl) {
        errorEl.textContent = xhr.responseJSON?.message || 'Failed to create promotion';
        errorEl.classList.remove('hidden');
      }
    })
    .always(() => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Upload & Create';
      }
    });
}

/**
 * Submits promotion update (optional video replacement).
 */
function handleEditSubmit() {
  const id = document.getElementById('edit-id')?.value;
  const title = (document.getElementById('edit-title')?.value || '').trim();
  const description = (document.getElementById('edit-description')?.value || '').trim();
  const captionText = (document.getElementById('edit-captions')?.value || '').trim();
  const fileInput = document.getElementById('edit-video');
  const published = document.getElementById('edit-published')?.checked;
  const errorEl = document.getElementById('edit-error');
  const submitBtn = document.getElementById('submit-edit-btn');

  if (!id || !title || !description || !captionText) {
    if (errorEl) {
      errorEl.textContent = 'Title, description, and captions are all required.';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('description', description);
  formData.append('caption_text', captionText);
  formData.append('published', published ? 'true' : 'false');

  const file = fileInput?.files?.[0];
  if (file) {
    const fileError = validateVideoFile(file);
    if (fileError) {
      if (errorEl) {
        errorEl.textContent = fileError;
        errorEl.classList.remove('hidden');
      }
      return;
    }
    formData.append('video', file);
  }

  errorEl?.classList.add('hidden');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving Changes…';
  }

  api.put(`/promos/${id}`, formData)
    .done(() => {
      closeModal(document.getElementById('edit-modal'));
      showToast('Promotion updated successfully', 'success');
      loadPromos();
    })
    .fail((xhr) => {
      if (errorEl) {
        errorEl.textContent = xhr.responseJSON?.message || 'Failed to update promotion';
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

