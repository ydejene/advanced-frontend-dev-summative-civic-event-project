/**
 * Homepage controller.
 * Initializes the application shell and hero search form.
 * Handles access-denied notifications from route guards and dynamically
 * adapts homepage call-to-actions based on authentication state.
 */
import { initShell } from '../components.js';
import { showToast } from '../utils.js';
import { isAuthenticated, getUser } from '../auth.js';

$(function () {
  initShell('home');
  initHeroSearch();
  checkRouteAlerts();
  updateAuthDependentContent();
});

/** Binds the hero search form to the events page with a query parameter. */
function initHeroSearch() {
  $('#hero-search-form').on('submit', function (e) {
    e.preventDefault();
    const query = $('#hero-search-input').val()?.trim();
    if (query) {
      window.location.href = `/pages/events/index.html?search=${encodeURIComponent(query)}`;
    } else {
      window.location.href = '/pages/events/index.html';
    }
  });
}

/** Checks for security feedback returned from frontend route guards. */
function checkRouteAlerts() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('error') === 'forbidden') {
    showToast('Access denied: That area requires administrator privileges.', 'error');
    // Clean up query string from browser address bar without reloading
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

/**
 * Updates homepage cards based on whether the visitor is currently authenticated.
 * Ensures the featured promotion and community participation cards reflect accurate actions.
 */
function updateAuthDependentContent() {
  const authenticated = isAuthenticated();
  const user = getUser();

  // Featured Promotion Card action
  const promoCtaBtn = document.getElementById('promo-cta-btn');
  if (promoCtaBtn) {
    // Both visitors and authenticated users can access the promotions catalog
    promoCtaBtn.setAttribute('href', '/pages/promotions/index.html');
    promoCtaBtn.textContent = 'Watch promotions';
  }

  // Community participation card
  const ctaTitle = document.getElementById('community-cta-title');
  const ctaDesc = document.getElementById('community-cta-desc');
  const ctaAction = document.getElementById('community-cta-action');

  if (ctaTitle && ctaDesc && ctaAction) {
    if (authenticated) {
      const firstName = user?.full_name?.split(' ')[0] || 'Community Member';
      ctaTitle.textContent = `Welcome back, ${firstName}!`;
      ctaDesc.textContent = 'Explore upcoming civic events, register your attendance, or check community announcements.';
      ctaAction.innerHTML = '<a href="/pages/events/index.html" class="btn-primary text-sm inline-flex items-center justify-center">Explore Events</a>';
    } else {
      ctaTitle.textContent = 'Join the Community';
      ctaDesc.textContent = 'Create an account to register for events, receive civic announcements and stay connected with your neighbourhood.';
      ctaAction.innerHTML = '<a href="/pages/auth/signup.html" class="btn-primary text-sm inline-flex items-center justify-center">Create a free account</a>';
    }
  }

  // Bottom "Get Involved" CTA secondary button
  const bottomCtaSec = document.getElementById('bottom-cta-secondary');
  if (bottomCtaSec) {
    if (authenticated) {
      bottomCtaSec.setAttribute('href', '/pages/user/registrations.html');
      bottomCtaSec.textContent = 'My Registrations';
    } else {
      bottomCtaSec.setAttribute('href', '/pages/auth/signup.html');
      bottomCtaSec.textContent = 'Sign Up Free';
    }
  }
}

/*
 * Cross-tab synchronization:
 * When login or logout occurs in another tab, update homepage cards immediately.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('auth-state-changed', () => {
    updateAuthDependentContent();
  });
}
