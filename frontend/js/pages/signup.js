/**
 * Signup page controller.
 * Handles client validation, real-time password requirements feedback,
 * accessible visibility toggles, and user account registration via POST /api/auth/signup.
 */
import { initShell } from '../components.js';
import { signup } from '../auth.js';
import { requireGuest } from '../guards.js';

// Standard RFC 5322 compatible email regex matching HTML5 and backend express-validator
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

$(function () {
  // Prevent authenticated users from accessing the signup page
  if (!requireGuest()) return;

  initShell();
  bindPasswordToggles();
  bindPasswordRequirements();
  bindSignupForm();
});

/**
 * Toggles password visibility for both password and confirm_password fields independently.
 */
function bindPasswordToggles() {
  setupToggle('toggle-pw-btn', 'password');
  setupToggle('toggle-confirm-pw-btn', 'confirm_password');

  function setupToggle(btnId, inputId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;

    btn.addEventListener('click', () => {
      const isVisible = input.type === 'text';
      input.type = isVisible ? 'password' : 'text';

      btn.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
      btn.setAttribute('aria-pressed', String(!isVisible));

      const eyeIcon = btn.querySelector('.eye-icon');
      const eyeSlashIcon = btn.querySelector('.eye-slash-icon');

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
}

/**
 * Password complexity rules matching backend PASSWORD_REGEX:
 * Minimum 8 characters, at least one uppercase, one lowercase, one number, and one special character.
 */
const PASSWORD_RULES = {
  length:  { el: () => document.getElementById('rule-length'),  test: (val) => val.length >= 8 },
  upper:   { el: () => document.getElementById('rule-upper'),   test: (val) => /[A-Z]/.test(val) },
  lower:   { el: () => document.getElementById('rule-lower'),   test: (val) => /[a-z]/.test(val) },
  number:  { el: () => document.getElementById('rule-number'),  test: (val) => /\d/.test(val) },
  special: { el: () => document.getElementById('rule-special'), test: (val) => /[\W_]/.test(val) },
};

/**
 * Updates password requirements checklist UI.
 * Distinct styling:
 * - Satisfied: teal text with checkmark (✓)
 * - Unmet (dirty/submitted): red text with cross (✗)
 * - Untouched: neutral gray with circle (○)
 *
 * @param {string} val - Current password value
 * @param {boolean} isSubmitted - Whether form submission was attempted
 */
function updatePasswordChecklist(val = '', isSubmitted = false) {
  let allPassed = true;
  const isDirty = val.length > 0;
  const container = document.getElementById('pw-checklist');

  for (const [key, rule] of Object.entries(PASSWORD_RULES)) {
    const rowEl = rule.el();
    if (!rowEl) continue;

    const iconEl = rowEl.querySelector('.rule-icon');
    const passed = rule.test(val);

    if (passed) {
      rowEl.className = 'flex items-center gap-2 text-teal font-medium';
      if (iconEl) {
        iconEl.textContent = '✓';
        iconEl.className = 'rule-icon inline-block w-4 text-center font-bold text-teal';
      }
    } else {
      allPassed = false;
      if (isDirty || isSubmitted) {
        rowEl.className = 'flex items-center gap-2 text-red-600 font-medium';
        if (iconEl) {
          iconEl.textContent = '✗';
          iconEl.className = 'rule-icon inline-block w-4 text-center font-bold text-red-600';
        }
      } else {
        rowEl.className = 'flex items-center gap-2 text-gray-500';
        if (iconEl) {
          iconEl.textContent = '○';
          iconEl.className = 'rule-icon inline-block w-4 text-center font-bold text-gray-400';
        }
      }
    }
  }

  // Visual highlight for the container box
  if (container) {
    if (allPassed && isDirty) {
      container.className = 'mt-2.5 p-3 rounded-md bg-soft-mint/20 border border-teal/40 text-xs space-y-1.5 transition-colors duration-150';
    } else if (!allPassed && (isDirty || isSubmitted)) {
      container.className = 'mt-2.5 p-3 rounded-md bg-red-50/50 border border-red-300 text-xs space-y-1.5 transition-colors duration-150';
    } else {
      container.className = 'mt-2.5 p-3 rounded-md bg-gray-50 border border-gray-200 text-xs space-y-1.5 transition-colors duration-150';
    }
  }

  return allPassed;
}

/**
 * Real-time password requirement tracker on input.
 */
function bindPasswordRequirements() {
  const passwordInput = document.getElementById('password');
  if (!passwordInput) return;

  passwordInput.addEventListener('input', () => {
    updatePasswordChecklist(passwordInput.value, false);
  });
}

/**
 * Validates and submits registration data.
 */
function bindSignupForm() {
  const form = document.getElementById('signup-form');
  const submitBtn = document.getElementById('signup-btn');
  const nameInput = document.getElementById('full_name');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirm_password');

  const nameError = document.getElementById('full_name-error');
  const emailError = document.getElementById('email-error');
  const passwordError = document.getElementById('password-error');
  const confirmPasswordError = document.getElementById('confirm_password-error');
  const formError = document.getElementById('form-error');
  const formSuccess = document.getElementById('form-success');

  if (!form) return;

  // Real-time clearance of field errors on input
  nameInput?.addEventListener('input', () => clearFieldError(nameInput, nameError));
  emailInput?.addEventListener('input', () => clearFieldError(emailInput, emailError));
  passwordInput?.addEventListener('input', () => {
    clearFieldError(passwordInput, passwordError);
    if (confirmPasswordInput?.value && confirmPasswordInput.value === passwordInput.value) {
      clearFieldError(confirmPasswordInput, confirmPasswordError);
    }
  });
  confirmPasswordInput?.addEventListener('input', () => {
    if (confirmPasswordInput.value === passwordInput?.value) {
      clearFieldError(confirmPasswordInput, confirmPasswordError);
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear banner messages
    if (formError) {
      formError.textContent = '';
      formError.classList.add('hidden');
    }
    if (formSuccess) {
      formSuccess.textContent = '';
      formSuccess.classList.add('hidden');
    }

    const fullName = nameInput?.value.trim() || '';
    const email = emailInput?.value.trim() || '';
    const password = passwordInput?.value || '';
    const confirmPassword = confirmPasswordInput?.value || '';

    // Client-side validation for all fields
    let hasError = false;
    let firstInvalidInput = null;

    if (!fullName) {
      showFieldError(nameInput, nameError, 'Full name is required.');
      hasError = true;
      if (!firstInvalidInput) firstInvalidInput = nameInput;
    } else if (fullName.length < 2) {
      showFieldError(nameInput, nameError, 'Full name must be at least 2 characters.');
      hasError = true;
      if (!firstInvalidInput) firstInvalidInput = nameInput;
    } else {
      clearFieldError(nameInput, nameError);
    }

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

    // Validate password complexity against all rules
    const passwordMeetsRules = updatePasswordChecklist(password, true);

    if (!password) {
      showFieldError(passwordInput, passwordError, 'Password is required.');
      hasError = true;
      if (!firstInvalidInput) firstInvalidInput = passwordInput;
    } else if (!passwordMeetsRules) {
      showFieldError(
        passwordInput,
        passwordError,
        'Password does not meet all complexity requirements.'
      );
      hasError = true;
      if (!firstInvalidInput) firstInvalidInput = passwordInput;
    } else {
      clearFieldError(passwordInput, passwordError);
    }

    if (!confirmPassword) {
      showFieldError(confirmPasswordInput, confirmPasswordError, 'Please confirm your password.');
      hasError = true;
      if (!firstInvalidInput) firstInvalidInput = confirmPasswordInput;
    } else if (password !== confirmPassword) {
      showFieldError(confirmPasswordInput, confirmPasswordError, 'Passwords do not match.');
      hasError = true;
      if (!firstInvalidInput) firstInvalidInput = confirmPasswordInput;
    } else {
      clearFieldError(confirmPasswordInput, confirmPasswordError);
    }

    // Stop invalid submission from reaching the API; focus first invalid field
    if (hasError) {
      firstInvalidInput?.focus();
      return;
    }

    setLoading(true);

    try {
      /*
       * Security constraint:
       * Only full_name, email, and password are submitted.
       * Role is intentionally excluded so no client can self-assign elevated privileges.
       */
      await signup({
        full_name: fullName,
        email,
        password,
      });

      // Show immediate confirmation banner
      if (formSuccess) {
        formSuccess.textContent = 'Account created successfully! Redirecting to login…';
        formSuccess.classList.remove('hidden');
      }

      // Reset sensitive password fields after confirmed success
      if (passwordInput) passwordInput.value = '';
      if (confirmPasswordInput) confirmPasswordInput.value = '';

      // Redirect to login page after brief confirmation
      setTimeout(() => {
        window.location.href = '/pages/auth/login.html?registered=true';
      }, 600);
    } catch (err) {
      if (formError) {
        formError.textContent = err.message || 'Registration failed. Please try again.';
        formError.classList.remove('hidden');
        formError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      setLoading(false);

      // Security practice: Clear password fields on rejection, PRESERVE name and email
      if (passwordInput) passwordInput.value = '';
      if (confirmPasswordInput) confirmPasswordInput.value = '';
      updatePasswordChecklist('', false);
      passwordInput?.focus();
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
        Creating account…
      `;
    } else {
      submitBtn.textContent = 'Create account';
    }
  }
}
