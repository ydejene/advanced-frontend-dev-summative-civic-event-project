/**
 * User Profile Controller
 * Handles loading authenticated user profile details, client-side input validation,
 * permitted profile updates (full_name and email only), and session synchronization.
 */
import { initShell } from '../components.js';
import { requireAuth } from '../guards.js';
import api from '../api.js';
import { updateUserSession, getUser } from '../auth.js';
import { formatDate, escapeHtml, showToast } from '../utils.js';

// Route guard: Require active session
if (!requireAuth()) {
  // If not authenticated, requireAuth redirects to login
}

let currentProfile = null;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Initializes the Profile page.
 */
function init() {
  initShell();
  loadProfile();
  bindFormEvents();

  window.addEventListener('auth-state-changed', () => {
    if (!requireAuth()) return;
    loadProfile();
  });
}

/**
 * Fetches user profile data from GET /api/users/profile/me.
 */
function loadProfile() {
  const loading = document.getElementById('profile-loading');
  const content = document.getElementById('profile-content');

  loading?.classList.remove('hidden');
  content?.classList.add('hidden');

  api.get('/users/profile/me')
    .done((res) => {
      const data = res?.data;
      if (!data) throw new Error('Profile not found');
      currentProfile = data;
      renderProfile(data);
    })
    .fail((xhr) => {
      loading?.classList.add('hidden');
      if (xhr.status !== 401) {
        showAlert(xhr.responseJSON?.message || 'Failed to load user profile.', 'error');
      }
    });
}

/**
 * Renders user profile information and populates form fields.
 * @param {Object} user
 */
function renderProfile(user) {
  const loading = document.getElementById('profile-loading');
  const content = document.getElementById('profile-content');
  const avatarInitials = document.getElementById('profile-avatar-initials');
  const displayName = document.getElementById('profile-display-name');
  const displayEmail = document.getElementById('profile-display-email');
  const roleBadge = document.getElementById('role-badge');
  const statusBadge = document.getElementById('status-badge');
  const nameInput = document.getElementById('profile-name-input');
  const emailInput = document.getElementById('profile-email-input');
  const readonlyRole = document.getElementById('readonly-role');
  const readonlyStatus = document.getElementById('readonly-status');
  const readonlyCreated = document.getElementById('readonly-created');

  loading?.classList.add('hidden');
  content?.classList.remove('hidden');

  // Avatar initials
  const initials = (user.full_name || 'User')
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (avatarInitials) avatarInitials.textContent = initials || 'U';
  if (displayName) displayName.textContent = user.full_name || 'Civic Member';
  if (displayEmail) displayEmail.textContent = user.email || '';

  // Form inputs
  if (nameInput) nameInput.value = user.full_name || '';
  if (emailInput) emailInput.value = user.email || '';

  // Role badge
  const isAdminRole = user.role === 'admin';
  if (roleBadge) {
    if (isAdminRole) {
      roleBadge.className = 'badge bg-teal text-white text-xs font-semibold px-2.5 py-1 rounded';
      roleBadge.textContent = 'Platform Administrator';
    } else {
      roleBadge.className = 'badge bg-soft-mint text-deep-teal text-xs font-semibold px-2.5 py-1 rounded';
      roleBadge.textContent = 'Community Member';
    }
  }

  // Account status badge
  if (statusBadge) {
    if (user.is_active) {
      statusBadge.className = 'badge bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1 rounded';
      statusBadge.textContent = 'Active';
    } else {
      statusBadge.className = 'badge bg-red-100 text-red-800 text-xs font-semibold px-2.5 py-1 rounded';
      statusBadge.textContent = 'Disabled';
    }
  }

  // Readonly summaries
  if (readonlyRole) readonlyRole.textContent = isAdminRole ? 'Administrator' : 'Community Member';
  if (readonlyStatus) readonlyStatus.textContent = user.is_active ? 'Active' : 'Disabled';
  if (readonlyCreated) readonlyCreated.textContent = formatDate(user.created_at) || 'Recently';
}

/**
 * Attaches form submission and reset event listeners.
 */
function bindFormEvents() {
  const form = document.getElementById('profile-form');
  const resetBtn = document.getElementById('profile-reset-btn');
  const alertClose = document.getElementById('profile-alert-close');

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSubmit();
  });

  resetBtn?.addEventListener('click', () => {
    if (currentProfile) {
      renderProfile(currentProfile);
      clearValidationErrors();
      showToast('Form reset to saved profile data', 'info');
    }
  });

  alertClose?.addEventListener('click', () => {
    document.getElementById('profile-alert')?.classList.add('hidden');
  });
}

/**
 * Validates and submits updated profile data.
 */
function handleSubmit() {
  clearValidationErrors();

  const nameInput = document.getElementById('profile-name-input');
  const emailInput = document.getElementById('profile-email-input');
  const submitBtn = document.getElementById('profile-submit-btn');

  const fullName = (nameInput?.value || '').trim();
  const email = (emailInput?.value || '').trim();

  let hasError = false;

  if (!fullName) {
    showFieldError('name-error', 'Full name cannot be empty.');
    nameInput?.focus();
    hasError = true;
  }

  if (!email) {
    showFieldError('email-error', 'Email address is required.');
    if (!hasError) emailInput?.focus();
    hasError = true;
  } else if (!EMAIL_REGEX.test(email)) {
    showFieldError('email-error', 'Please enter a valid email address.');
    if (!hasError) emailInput?.focus();
    hasError = true;
  }

  if (hasError) return;

  // Check if anything actually changed
  if (currentProfile && fullName === currentProfile.full_name && email === currentProfile.email) {
    showAlert('No profile changes detected to save.', 'info');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving Changes…';
  }

  // The backend validator explicitly forbids sending 'role' or 'is_active'
  const payload = {
    full_name: fullName,
    email: email
  };

  api.patch('/users/profile/me', payload)
    .done((res) => {
      const updatedUser = res?.data;
      if (updatedUser) {
        currentProfile = updatedUser;
        renderProfile(updatedUser);

        // Synchronize updated user profile in session storage so nav updates immediately
        updateUserSession(updatedUser);

        showAlert('Your profile details were updated successfully.', 'success');
        showToast('Profile updated successfully', 'success');
      }
    })
    .fail((xhr) => {
      let errorMessage = 'Failed to update profile. Please try again.';
      if (xhr.status === 409) {
        errorMessage = 'This email address is already in use by another account.';
        showFieldError('email-error', errorMessage);
      } else if (xhr.responseJSON?.message) {
        errorMessage = xhr.responseJSON.message;
      }
      showAlert(errorMessage, 'error');
    })
    .always(() => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
      }
    });
}

/**
 * Displays an inline validation error message beneath an input.
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
 * Clears all inline validation errors.
 */
function clearValidationErrors() {
  ['name-error', 'email-error'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = '';
      el.classList.add('hidden');
    }
  });
}

/**
 * Displays top alert banner.
 * @param {string} msg
 * @param {'info'|'error'|'success'} type
 */
function showAlert(msg, type = 'info') {
  const alertEl = document.getElementById('profile-alert');
  const msgEl = document.getElementById('profile-alert-message');
  const iconEl = document.getElementById('profile-alert-icon');

  if (!alertEl || !msgEl) return;

  msgEl.textContent = msg;

  if (type === 'error') {
    alertEl.className = 'card p-4 mb-6 bg-red-50 border border-red-200 text-red-800';
    if (iconEl) iconEl.innerHTML = '<svg class="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
  } else if (type === 'success') {
    alertEl.className = 'card p-4 mb-6 bg-green-50 border border-green-200 text-green-800';
    if (iconEl) iconEl.innerHTML = '<svg class="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
  } else {
    alertEl.className = 'card p-4 mb-6 bg-blue-50 border border-blue-200 text-blue-800';
    if (iconEl) iconEl.innerHTML = '<svg class="w-5 h-5 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
  }

  alertEl.classList.remove('hidden');
}

// Bootstrap on DOM readiness
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

