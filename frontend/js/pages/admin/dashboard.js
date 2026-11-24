/**
 * Administrator Dashboard Controller
 * Fetches and displays verified platform statistics from GET /api/dashboard/admin,
 * user growth trends, and navigation shortcuts to municipal admin consoles.
 */
import { initShell } from '../../components.js';
import { requireAdmin } from '../../guards.js';
import api from '../../api.js';
import { escapeHtml, showToast } from '../../utils.js';

// Enforce admin authorization
if (!requireAdmin()) {
  // If unauthorized, requireAdmin redirects immediately
}

/**
 * Initializes the Admin Dashboard page.
 */
function init() {
  initShell();
  loadDashboardStats();
  bindEvents();
}

/**
 * Fetches verified admin statistics from backend API.
 */
function loadDashboardStats() {
  const loading = document.getElementById('dashboard-loading');
  const content = document.getElementById('dashboard-content');
  const refreshBtn = document.getElementById('refresh-stats-btn');

  loading?.classList.remove('hidden');
  content?.classList.add('hidden');
  if (refreshBtn) refreshBtn.disabled = true;

  api.get('/dashboard/admin')
    .done((res) => {
      const data = res?.data;
      if (!data) throw new Error('Failed to load dashboard metrics');
      renderDashboard(data);
    })
    .fail((xhr) => {
      loading?.classList.add('hidden');
      showAlert(xhr.responseJSON?.message || 'Failed to load dashboard data from the portal.', 'error');
    })
    .always(() => {
      if (refreshBtn) refreshBtn.disabled = false;
    });
}

/**
 * Safely parses integer values from database count strings.
 * @param {*} val
 * @returns {number}
 */
function safeCount(val) {
  const n = parseInt(val, 10);
  return isNaN(n) ? 0 : n;
}

/**
 * Renders KPI cards and user growth breakdown table.
 * @param {Object} stats
 */
function renderDashboard(stats) {
  const loading = document.getElementById('dashboard-loading');
  const content = document.getElementById('dashboard-content');

  loading?.classList.add('hidden');
  content?.classList.remove('hidden');

  // Users metrics
  const totalUsers = safeCount(stats.users?.total_users);
  const activeUsers = safeCount(stats.users?.active_users);
  const inactiveUsers = safeCount(stats.users?.inactive_users);

  setText('stat-total-users', totalUsers.toLocaleString());
  setText('stat-active-users', activeUsers.toLocaleString());
  setText('stat-inactive-users', inactiveUsers.toLocaleString());

  // Events metrics
  const totalEvents = safeCount(stats.events?.total_events);
  const upcomingEvents = safeCount(stats.events?.upcoming_events);
  const pastEvents = safeCount(stats.events?.past_events);

  setText('stat-total-events', totalEvents.toLocaleString());
  setText('stat-upcoming-events', upcomingEvents.toLocaleString());
  setText('stat-past-events', pastEvents.toLocaleString());

  // Registrations & feedback metrics
  const totalRegistrations = safeCount(stats.registrations?.total_registrations);
  const totalFeedbacks = safeCount(stats.feedbacks?.total_feedback);

  setText('stat-total-registrations', totalRegistrations.toLocaleString());
  setText('stat-total-feedbacks', totalFeedbacks.toLocaleString());

  // Announcements, promos & notifications
  const totalAnnouncements = safeCount(stats.announcements?.total_announcements);
  const totalPromos = safeCount(stats.promos?.total_promos);
  const totalNotifications = safeCount(stats.notifications?.total_notifications);

  setText('stat-total-announcements', totalAnnouncements.toLocaleString());
  setText('stat-total-promos', totalPromos.toLocaleString());
  setText('stat-total-notifications', totalNotifications.toLocaleString());

  // Render User Growth Table
  renderUserGrowth(stats.user_growth);
}

/**
 * Helper to update text content of element by ID.
 * @param {string} id
 * @param {string} text
 */
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/**
 * Renders user registration growth rows.
 * @param {Array} growthRows
 */
function renderUserGrowth(growthRows) {
  const tbody = document.getElementById('growth-tbody');
  if (!tbody) return;

  if (!Array.isArray(growthRows) || growthRows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="2" class="py-4 px-4 text-center text-xs text-gray-500 italic">
          No monthly user registration data recorded for the past 6 months.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = growthRows.map((row) => {
    const month = escapeHtml(row.month || 'Unknown');
    const newUsers = safeCount(row.new_users);

    return `
      <tr class="hover:bg-gray-50/70 transition-colors">
        <td class="py-3 px-4 font-mono text-xs font-medium text-gray-700">
          ${month}
        </td>
        <td class="py-3 px-4 text-right font-semibold text-deep-teal text-sm">
          ${newUsers.toLocaleString()}
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Binds refresh and alert button events.
 */
function bindEvents() {
  const refreshBtn = document.getElementById('refresh-stats-btn');
  const alertClose = document.getElementById('dashboard-alert-close');

  refreshBtn?.addEventListener('click', () => {
    loadDashboardStats();
    showToast('Platform metrics refreshed', 'info');
  });

  alertClose?.addEventListener('click', () => {
    document.getElementById('dashboard-alert')?.classList.add('hidden');
  });
}

/**
 * Displays top alert banner.
 * @param {string} msg
 * @param {'info'|'error'|'success'} type
 */
function showAlert(msg, type = 'info') {
  const alertEl = document.getElementById('dashboard-alert');
  const msgEl = document.getElementById('dashboard-alert-message');
  const iconEl = document.getElementById('dashboard-alert-icon');

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

