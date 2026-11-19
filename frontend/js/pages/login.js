/**
 * Login page controller.
 * Handles client validation, password visibility, authentication via POST /api/auth/login,
 * and post-login redirection based on user role and query parameters.
 */
import { initShell } from '../components.js';
import { login } from '../auth.js';
import { requireGuest } from '../guards.js';

// Standard RFC 5322 compatible email regex matching HTML5 and backend express-validator
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

$(function () {
  // Prevent authenticated users from accessing the login page
  if (!requireGuest()) return;

  initShell();
  checkQueryParams();
  bindPasswordToggle();
  bindLoginForm();
});

/**
 * Checks URL parameters for redirect alerts (e.g. registration success or session expiry).
 */
function checkQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const successEl = document.getElementById('form-success');
  const errorEl = document.getElementById('form-error');

  if (params.get('registered') === 'true') {
    if (successEl) {
      successEl.textContent = 'Account created successfully! Please log in with your credentials.';
      successEl.classList.remove('hidden');
    }
  } else if (params.get('expired') === 'true') {
    if (errorEl) {
      errorEl.textContent = 'Your session has expired. Please log in again.';
      errorEl.classList.remove('hidden');
    }
  } else if (params.get('unauthorized') === 'true') {
    if (errorEl) {
      errorEl.textContent = 'Please log in to access that page.';
      errorEl.classList.remove('hidden');
    }
  }
}

/**
 * Toggles password visibility between masked and plain text.
 */
function bindPasswordToggle() {
  const toggleBtn = document.getElementById('toggle-password-btn');
  if (!toggleBtn) return;

  const targetId = toggleBtn.getAttribute('data-target') || 'password';
  const passwordInput = document.getElementById(targetId);
  if (!passwordInput) return;

  toggleBtn.addEventListener('click', () => {
    const isVisible = passwordInput.type === 'text';
    passwordInput.type = isVisible ? 'password' : 'text';

    toggleBtn.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
    toggleBtn.setAttribute('aria-pressed', String(!isVisible));

    const eyeIcon = toggleBtn.querySelector('.eye-icon');
    const eyeSlashIcon = toggleBtn.querySelector('.eye-slash-icon');

    if (eyeIcon && eyeSlashIcon) {
      if (isVisible) {
        eyeIcon.classList.remove('hidden');
        eyeSlashIcon.classList.add('hidden');
      } else {
        eyeIcon.classList.add('hidden');
        eyeSlashIcon.classList.remove('hidden');
      }
    }
  });
}

/**
 * Validates and submits login credentials.
 */
function bindLoginForm() {
  const form = document.getElementById('login-form');
  const submitBtn = document.getElementById('login-btn');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const emailError = document.getElementById('email-error');
  const passwordError = document.getElementById('password-error');
  const formError = document.getElementById('form-error');

  if (!form) return;

  // Real-time clearance of field errors on user input
  emailInput?.addEventListener('input', () => clearFieldError(emailInput, emailError));
  passwordInput?.addEventListener('input', () => clearFieldError(passwordInput, passwordError));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear previous banner errors
    if (formError) {
      formError.textContent = '';
      formError.classList.add('hidden');
    }

    const email = emailInput?.value.trim() || '';
    const password = passwordInput?.value || '';

    // Client-side validation
    let hasError = false;
    let firstInvalidInput = null;

    if (!email) {
      showFieldError(emailInput, emailError, 'Email address is required.');
      hasError = true;
      if (!firstInvalidInput) firstInvalidInput = emailInput;
    } else if (!EMAIL_REGEX.test(email)) {
      showFieldError(emailInput, emailError, 'Please enter a valid email address (e.g. name@example.com).');
      hasError = true;
      if (!firstInvalidInput) firstInvalidInput = emailInput;
    } else {
      clearFieldError(emailInput, emailError);
    }

    if (!password) {
      showFieldError(passwordInput, passwordError, 'Password is required.');
      hasError = true;
      if (!firstInvalidInput) firstInvalidInput = passwordInput;
    } else {
      clearFieldError(passwordInput, passwordError);
    }

    if (hasError) {
      firstInvalidInput?.focus();
      return;
    }

    // Submission loading state
    setLoading(true);

    try {
      const { user } = await login(email, password);

      // Determine redirect target
      const params = new URLSearchParams(window.location.search);
      const redirectTarget = params.get('redirect');

      /*
       * Safe redirect validation:
       * Only allow relative internal paths to prevent open redirect vulnerabilities.
       */
      if (redirectTarget && redirectTarget.startsWith('/') && !redirectTarget.startsWith('//')) {
        window.location.href = redirectTarget;
      } else if (user?.role === 'admin') {
        window.location.href = '/pages/admin/dashboard.html';
      } else {
        window.location.href = '/index.html';
      }
    } catch (err) {
      if (formError) {
        formError.textContent = err.message || 'Invalid email or password. Please verify your credentials.';
        formError.classList.remove('hidden');
      }
      setLoading(false);

      // Clear password for security, preserve entered email
      if (passwordInput) {
        passwordInput.value = '';
        passwordInput.focus();
      }
    }
  });

  function clearFieldError(input, errorEl) {
    if (input) {
      input.classList.remove('border-red-500', 'focus:ring-red-500');
      input.removeAttribute('aria-invalid');
    }
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
    }
  }

  function showFieldError(input, errorEl, message) {
    if (input) {
      input.classList.add('border-red-500', 'focus:ring-red-500');
      input.setAttribute('aria-invalid', 'true');
    }
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    }
  }

  function setLoading(loading) {
    if (!submitBtn) return;
    submitBtn.disabled = loading;
    if (loading) {
      submitBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Logging in…
      `;
    } else {
      submitBtn.textContent = 'Log in';
    }
  }
}
