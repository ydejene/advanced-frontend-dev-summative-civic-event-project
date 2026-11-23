/**
 * Shared header, footer and navigation initialization.
 * Renders the application shell and reflects current authentication state.
 * Supports cross-tab synchronization so navigation updates when auth state changes.
 */
import { isAuthenticated, isAdmin, getUser, logout } from './auth.js';
import { escapeHtml } from './utils.js';

let currentShellPage = '';

/**
 * Generates the shared header HTML.
 * Navigation controls dynamically adapt based on session authentication state and user role.
 *
 * Role-based navigation rule:
 * - Visitors see 'Log in' and 'Sign up' actions.
 * - Authenticated users see their profile dropdown, notification bell, and account links.
 * - Administrators additionally receive the 'Admin Dashboard' link in both desktop and mobile menus.
 * - Normal users never receive admin navigation links.
 *
 * @param {string} [activePage] - Identifier matching a nav item (home|events|announcements|promotions).
 * @returns {string}
 */
function headerHTML(activePage = '') {
  currentShellPage = activePage || currentShellPage;
  const user = getUser();
  const authenticated = isAuthenticated();
  const admin = isAdmin();

  const navItems = [
    { id: 'home',          label: 'Home',          href: '/index.html' },
    { id: 'events',        label: 'Events',         href: '/pages/events/index.html' },
    { id: 'announcements', label: 'Announcements',  href: '/pages/announcements/index.html' },
    { id: 'promotions',    label: 'Promotions',     href: '/pages/promotions/index.html' },
  ];

  const navLinks = navItems.map(item => {
    const active = currentShellPage === item.id;
    return `<a href="${item.href}"
         data-nav-id="${item.id}"
         class="${active ? 'nav-link-active' : 'nav-link'}"
         ${active ? 'aria-current="page"' : ''}>${item.label}</a>`;
  }).join('');

  /* Auth controls — login/signup for guests; profile dropdown for authenticated users. */
  let authControls;
  if (authenticated) {
    const displayName = escapeHtml(user?.full_name?.split(' ')[0] ?? 'Account');
    const adminLink = admin
      ? `<a href="/pages/admin/dashboard.html" class="block px-4 py-2 text-sm text-teal font-medium hover:bg-soft-mint" role="menuitem">Admin Dashboard</a>
         <a href="/pages/admin/feedback.html" class="block px-4 py-2 text-sm text-teal font-medium hover:bg-soft-mint" role="menuitem">Event Feedback</a>`
      : '';
    authControls = `
      <div class="relative" id="profile-menu">
        <button type="button"
                class="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal cursor-pointer"
                aria-haspopup="true" aria-expanded="false" aria-controls="profile-dropdown"
                id="profile-menu-btn">
          <svg class="w-5 h-5 text-teal" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
               stroke-width="1.5" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/>
          </svg>
          <span>${displayName}</span>
          <svg class="w-4 h-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
               stroke-width="2" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/>
          </svg>
        </button>
        <div id="profile-dropdown"
             class="absolute right-0 mt-2 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 hidden"
             role="menu" aria-labelledby="profile-menu-btn">
          ${adminLink}
          <a href="/pages/user/profile.html"
             class="block px-4 py-2 text-sm text-gray-700 hover:bg-soft-mint" role="menuitem">My Profile</a>
          <a href="/pages/user/registrations.html"
             class="block px-4 py-2 text-sm text-gray-700 hover:bg-soft-mint" role="menuitem">My Registrations</a>
          <a href="/pages/user/service-requests.html"
             class="block px-4 py-2 text-sm text-gray-700 hover:bg-soft-mint" role="menuitem">My Service Requests</a>
          <hr class="my-1 border-gray-100">
          <button type="button" id="logout-btn"
                  class="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer" role="menuitem">
            Logout
          </button>
        </div>
      </div>`;
  } else {
    authControls = `
      <a href="/pages/auth/login.html" class="btn-secondary text-xs px-4 py-2">Log in</a>
      <a href="/pages/auth/signup.html" class="btn-primary text-xs px-4 py-2">Sign up</a>`;
  }

  /* Notification bell — visible only when authenticated. */
  const notificationBell = authenticated ? `
    <a href="/pages/notifications/index.html"
       class="relative p-1 text-gray-500 hover:text-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
       aria-label="Notifications">
      <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
           stroke-width="1.5" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round"
              d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"/>
      </svg>
      <span id="notif-badge"
            class="absolute -top-0.5 -right-0.5 w-4 h-4 text-xs bg-warm-amber text-deep-teal rounded-full hidden
                   flex items-center justify-center font-bold"
            aria-label="unread notifications">
      </span>
    </a>` : '';

  return `
<header class="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
  <div class="container-content">
    <div class="flex items-center justify-between h-16">

      <!-- Logo -->
      <a href="/index.html" class="flex-shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal rounded"
         aria-label="CivicEvents — Home">
        <img src="/assets/icons/civicevents-logo.svg"
             alt="CivicEvents"
             class="h-9 w-auto"
             onerror="this.src='/assets/icons/civicevents-logo.png'">
      </a>

      <!-- Desktop navigation -->
      <nav class="hidden md:flex items-center gap-6" aria-label="Primary navigation">
        ${navLinks}
      </nav>

      <!-- Desktop right controls -->
      <div class="hidden md:flex items-center gap-3">
        <!-- Search -->
        <button type="button"
                class="p-1 text-gray-500 hover:text-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                aria-label="Search" id="search-toggle">
          <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
               stroke-width="1.5" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/>
          </svg>
        </button>
        ${notificationBell}
        ${authControls}
      </div>

      <!-- Mobile menu toggle -->
      <button type="button"
              class="md:hidden p-2 rounded-md text-gray-600 hover:bg-soft-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal cursor-pointer"
              aria-label="Open navigation menu" aria-expanded="false" aria-controls="mobile-menu"
              id="mobile-menu-btn">
        <svg class="w-6 h-6" id="mobile-menu-icon-open" xmlns="http://www.w3.org/2000/svg"
             fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/>
        </svg>
        <svg class="w-6 h-6 hidden" id="mobile-menu-icon-close" xmlns="http://www.w3.org/2000/svg"
             fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
        </svg>
      </button>

    </div>
  </div>

  <!-- Mobile navigation drawer -->
  <div id="mobile-menu" class="hidden md:hidden border-t border-gray-100 bg-white" aria-label="Mobile navigation">
    <nav class="container-content py-3 flex flex-col gap-1">
      ${navItems.map(item => `
        <a href="${item.href}"
           data-nav-id="${item.id}"
           class="block px-3 py-2.5 rounded-md text-sm font-medium ${currentShellPage === item.id ? 'text-teal bg-soft-mint' : 'text-gray-700 hover:bg-soft-mint hover:text-teal'}"
           ${currentShellPage === item.id ? 'aria-current="page"' : ''}>${item.label}</a>`).join('')}
      <hr class="my-2 border-gray-100">
      ${authenticated ? `
        <a href="/pages/user/profile.html"
           class="block px-3 py-2.5 rounded-md text-sm font-medium text-gray-700 hover:bg-soft-mint">My Profile</a>
        <a href="/pages/user/registrations.html"
           class="block px-3 py-2.5 rounded-md text-sm font-medium text-gray-700 hover:bg-soft-mint">My Registrations</a>
        <a href="/pages/notifications/index.html"
           class="block px-3 py-2.5 rounded-md text-sm font-medium text-gray-700 hover:bg-soft-mint">Notifications</a>
        ${admin ? `<a href="/pages/admin/dashboard.html"
                      class="block px-3 py-2.5 rounded-md text-sm font-medium text-teal font-semibold hover:bg-soft-mint">Admin Dashboard</a>
                   <a href="/pages/admin/feedback.html"
                      class="block px-3 py-2.5 rounded-md text-sm font-medium text-teal font-semibold hover:bg-soft-mint">Event Feedback</a>` : ''}
        <button type="button" id="mobile-logout-btn"
                class="block w-full text-left px-3 py-2.5 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 cursor-pointer">Logout</button>
      ` : `
        <a href="/pages/auth/login.html"
           class="block px-3 py-2.5 rounded-md text-sm font-medium text-teal hover:bg-soft-mint">Log in</a>
        <a href="/pages/auth/signup.html"
           class="btn-primary mt-1 w-full justify-center">Sign up</a>
      `}
    </nav>
  </div>

</header>`;
}

/**
 * Generates the shared footer HTML.
 *
 * Authentication-aware Account section:
 * - Guests see Log in and Sign up.
 * - Authenticated users see My Profile and My Registrations.
 *
 * The footer re-renders on 'auth-state-changed' so cross-tab login/logout
 * is reflected immediately without a page reload.
 *
 * @returns {string}
 */
function footerHTML() {
  const year = new Date().getFullYear();
  const authenticated = isAuthenticated();

  /*
   * Role-based footer account links:
   * Guests receive authentication entry points.
   * Authenticated users receive their personal account links.
   */
  const accountLinks = authenticated
    ? `<li><a href="/pages/user/profile.html" class="text-sm text-gray-400 hover:text-soft-mint">My Profile</a></li>
          <li><a href="/pages/user/registrations.html" class="text-sm text-gray-400 hover:text-soft-mint">My Registrations</a></li>`
    : `<li><a href="/pages/auth/login.html" class="text-sm text-gray-400 hover:text-soft-mint">Log in</a></li>
          <li><a href="/pages/auth/signup.html" class="text-sm text-gray-400 hover:text-soft-mint">Sign up</a></li>`;

  return `
<footer class="bg-deep-teal text-gray-300 mt-auto">
  <div class="container-content py-10">
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">

      <!-- Brand -->
      <div class="sm:col-span-2 lg:col-span-1">
        <a href="/index.html" aria-label="CivicEvents — Home"
           class="inline-block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal rounded">
          <img src="/assets/icons/civicevents-mark.svg" alt="CivicEvents" class="h-10 w-auto brightness-0 invert">
        </a>
        <p class="mt-3 text-sm leading-relaxed text-gray-400">
          Connecting our community through events, announcements and civic participation.
        </p>
      </div>

      <!-- Discover -->
      <div>
        <h3 class="text-sm font-semibold text-white mb-3 font-heading">Discover</h3>
        <ul class="space-y-2">
          <li><a href="/pages/events/index.html" class="text-sm text-gray-400 hover:text-soft-mint">Events</a></li>
          <li><a href="/pages/announcements/index.html" class="text-sm text-gray-400 hover:text-soft-mint">Announcements</a></li>
          <li><a href="/pages/promotions/index.html" class="text-sm text-gray-400 hover:text-soft-mint">Promotions</a></li>
        </ul>
      </div>

      <!-- Account (auth-aware) -->
      <div>
        <h3 class="text-sm font-semibold text-white mb-3 font-heading">Account</h3>
        <ul class="space-y-2">
          ${accountLinks}
        </ul>
      </div>

      <!-- Community -->
      <div>
        <h3 class="text-sm font-semibold text-white mb-3 font-heading">Community</h3>
        <ul class="space-y-2">
          <li><a href="/pages/user/service-requests.html" class="text-sm text-gray-400 hover:text-soft-mint">Service Requests</a></li>
          <li><a href="/pages/notifications/index.html" class="text-sm text-gray-400 hover:text-soft-mint">Notifications</a></li>
        </ul>
      </div>

    </div>

    <div class="border-t border-deep-teal/50 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
      <p class="text-xs text-gray-500">&copy; ${year} CivicEvents. All rights reserved.</p>
      <p class="text-xs text-gray-500">A civic community platform.</p>
    </div>
  </div>
</footer>`;
}

/**
 * Injects the header and footer into the page, then activates interactive controls.
 * @param {string} [activePage] - Active nav identifier passed through from each page.
 */
export function initShell(activePage = '') {
  if (activePage) currentShellPage = activePage;
  const headerEl = document.getElementById('site-header');
  const footerEl = document.getElementById('site-footer');

  if (headerEl) headerEl.innerHTML = headerHTML(currentShellPage);
  if (footerEl) footerEl.innerHTML = footerHTML();

  attachHeaderHandlers();
}

/** Attaches event listeners for mobile menu, profile dropdown, and logout. */
function attachHeaderHandlers() {
  /* Mobile menu toggle */
  const menuBtn    = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const iconOpen   = document.getElementById('mobile-menu-icon-open');
  const iconClose  = document.getElementById('mobile-menu-icon-close');

  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.toggle('hidden');
      menuBtn.setAttribute('aria-expanded', String(!isOpen));
      iconOpen?.classList.toggle('hidden', !isOpen);
      iconClose?.classList.toggle('hidden', isOpen);
    });

    /* Close mobile menu when focus moves outside */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !mobileMenu.classList.contains('hidden')) {
        mobileMenu.classList.add('hidden');
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.focus();
      }
    });
  }

  /* Profile dropdown toggle */
  const profileBtn      = document.getElementById('profile-menu-btn');
  const profileDropdown = document.getElementById('profile-dropdown');

  if (profileBtn && profileDropdown) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = profileDropdown.classList.toggle('hidden');
      profileBtn.setAttribute('aria-expanded', String(!isHidden));
    });

    document.addEventListener('click', () => {
      profileDropdown.classList.add('hidden');
      profileBtn.setAttribute('aria-expanded', 'false');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        profileDropdown.classList.add('hidden');
        profileBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* Logout handlers (desktop and mobile) — clears session and redirects */
  ['logout-btn', 'mobile-logout-btn'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      logout('/pages/auth/login.html');
    });
  });
}

/*
 * Cross-tab navigation synchronization:
 * When login or logout occurs in another tab, re-render both the header and
 * the footer so the Account section reflects the updated authentication state
 * immediately without requiring a manual page refresh.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('auth-state-changed', () => {
    const headerEl = document.getElementById('site-header');
    if (headerEl) {
      headerEl.innerHTML = headerHTML(currentShellPage);
      attachHeaderHandlers();
    }

    const footerEl = document.getElementById('site-footer');
    if (footerEl) {
      footerEl.innerHTML = footerHTML();
    }
  });
}
