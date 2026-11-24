/**
 * CivicEvents — My Registrations Controller
 *
 * Handles:
 *  - Route guard protection (authenticated users only)
 *  - Fetching user registrations via GET /api/event-registrations/my-registrations
 *  - Filtering by status (All, Confirmed, Cancelled)
 *  - Registration cancellation via POST /api/event-registrations/cancel
 *  - Informative database uniqueness / re-registration constraint messaging
 *  - Cross-tab session synchronization
 */
import { requireAuth } from '../guards.js';
import { initShell } from '../components.js';
import api from '../api.js';
import { formatDateTime, formatDate, escapeHtml, showToast, getCategoryInfo, openModal, closeModal as closeSharedModal, setupModalA11y } from '../utils.js';

let allRegistrations = [];
let activeTab = 'all'; // 'all' | 'registered' | 'cancelled'
let pendingCancelEventId = null;
let pendingCancelEventTitle = '';

// Route Guard Check
if (requireAuth()) {
  $(function () {
    initShell('registrations');
    bindEvents();
    loadRegistrations();
  });
}

/**
 * Binds UI interaction handlers.
 */
function bindEvents() {
  $('#tab-all').on('click', () => switchTab('all'));
  $('#tab-registered').on('click', () => switchTab('registered'));
  $('#tab-cancelled').on('click', () => switchTab('cancelled'));

  $('#registrations-retry-btn').on('click', loadRegistrations);

  // Modal handlers
  const cancelModalEl = document.getElementById('cancel-modal');
  $('#modal-abort-btn').on('click', closeModal);
  $('#modal-confirm-btn').on('click', executeCancellation);
  setupModalA11y(cancelModalEl, closeModal, true);

  // Cross-tab synchronization
  window.addEventListener('auth-state-changed', () => {
    loadRegistrations();
  });
}

/**
 * Switches the active tab filter and re-renders the list.
 * @param {'all'|'registered'|'cancelled'} tab
 */
function switchTab(tab) {
  activeTab = tab;

  const tabs = [
    { id: '#tab-all', key: 'all' },
    { id: '#tab-registered', key: 'registered' },
    { id: '#tab-cancelled', key: 'cancelled' },
  ];

  tabs.forEach(t => {
    const $el = $(t.id);
    if (t.key === tab) {
      $el.attr('aria-selected', 'true')
        .removeClass('border-transparent text-gray-500 font-medium')
        .addClass('border-teal text-teal font-semibold');
    } else {
      $el.attr('aria-selected', 'false')
        .removeClass('border-teal text-teal font-semibold')
        .addClass('border-transparent text-gray-500 font-medium');
    }
  });

  renderRegistrationsList();
}

/**
 * Fetches user registrations from GET /api/event-registrations/my-registrations.
 */
async function loadRegistrations() {
  const $loading = $('#registrations-loading');
  const $error = $('#registrations-error');
  const $empty = $('#registrations-empty');
  const $list = $('#registrations-list');

  $loading.removeClass('hidden');
  $error.addClass('hidden');
  $empty.addClass('hidden');
  $list.addClass('hidden');

  try {
    const res = await api.get('/event-registrations/my-registrations');
    allRegistrations = Array.isArray(res?.data) ? res.data : [];

    $loading.addClass('hidden');
    updateTabCounts();
    renderRegistrationsList();
  } catch (err) {
    $loading.addClass('hidden');
    $error.removeClass('hidden');
    const msg = err?.responseJSON?.message || 'Unable to retrieve your registrations. Please check your connection.';
    $('#registrations-error-msg').text(msg);
  }
}

/**
 * Updates count indicators in tab buttons.
 */
function updateTabCounts() {
  const total = allRegistrations.length;
  const registered = allRegistrations.filter(r => r.status === 'registered').length;
  const cancelled = allRegistrations.filter(r => r.status === 'cancelled').length;

  $('#count-all').text(total);
  $('#count-registered').text(registered);
  $('#count-cancelled').text(cancelled);
}

/**
 * Renders the filtered registration cards list or appropriate empty state.
 */
function renderRegistrationsList() {
  const $empty = $('#registrations-empty');
  const $list = $('#registrations-list');

  const filtered = allRegistrations.filter(r => {
    if (activeTab === 'all') return true;
    return r.status === activeTab;
  });

  if (filtered.length === 0) {
    $list.addClass('hidden').empty();
    $empty.removeClass('hidden');

    if (activeTab === 'registered') {
      $('#empty-state-title').text('No Confirmed Registrations');
      $('#empty-state-desc').text('You do not have any active event registrations at this time.');
    } else if (activeTab === 'cancelled') {
      $('#empty-state-title').text('No Cancelled Registrations');
      $('#empty-state-desc').text('You have not cancelled any event registrations.');
    } else {
      $('#empty-state-title').text('No Event Registrations Found');
      $('#empty-state-desc').text('You haven\'t registered for any civic events yet. Explore upcoming gatherings and workshops to get involved.');
    }
    return;
  }

  $empty.addClass('hidden');
  $list.removeClass('hidden').empty();

  filtered.forEach(reg => {
    const isRegistered = reg.status === 'registered';
    const detailUrl = `/pages/events/detail.html?id=${encodeURIComponent(reg.event_id)}`;
    const catInfo = getCategoryInfo({ title: reg.title, description: '' });
    const dateFormatted = reg.starts_at ? formatDateTime(reg.starts_at) : 'Date TBA';
    const locationFormatted = reg.location ? escapeHtml(reg.location) : 'Location to be announced';
    const registeredDate = reg.created_at ? formatDate(reg.created_at) : '';

    const statusBadge = isRegistered
      ? `<span class="badge-success text-xs font-semibold">Confirmed</span>`
      : `<span class="badge-warning text-xs font-semibold">Cancelled</span>`;

    const cancelButton = isRegistered
      ? `<button type="button"
                 class="cancel-btn text-xs text-red-600 hover:text-red-800 font-medium py-1.5 px-3 rounded hover:bg-red-50 transition-colors cursor-pointer"
                 data-event-id="${escapeHtml(reg.event_id)}"
                 data-event-title="${escapeHtml(reg.title || 'Event')}">
           Cancel Registration
         </button>`
      : `<span class="text-[11px] text-gray-400 italic">Registration cancelled</span>`;

    const cardHtml = `
      <article class="card p-5 sm:p-6 transition-shadow hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-5" aria-label="${escapeHtml(reg.title || 'Event registration')}">
        <div class="space-y-2 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="badge-teal text-[11px] font-semibold">${escapeHtml(catInfo.category)}</span>
            ${statusBadge}
            ${registeredDate ? `<span class="text-[11px] text-gray-400">• Registered on ${registeredDate}</span>` : ''}
          </div>

          <h2 class="font-heading font-bold text-deep-teal text-lg leading-snug">
            <a href="${detailUrl}" class="hover:underline hover:text-teal transition-colors">
              ${escapeHtml(reg.title || 'Civic Event')}
            </a>
          </h2>

          <div class="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-gray-600">
            <div class="flex items-center gap-1.5">
              <svg class="w-4 h-4 text-teal flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/>
              </svg>
              <span>${escapeHtml(dateFormatted)}</span>
            </div>

            <div class="flex items-center gap-1.5">
              <svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"/>
              </svg>
              <span>${locationFormatted}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-gray-100 flex-shrink-0">
          <a href="${detailUrl}" class="btn-secondary text-xs py-2 px-4 whitespace-nowrap">
            View Details
          </a>
          ${cancelButton}
        </div>
      </article>
    `;

    $list.append(cardHtml);
  });

  // Bind cancel triggers
  $('.cancel-btn').on('click', function () {
    const eventId = $(this).data('event-id');
    const eventTitle = $(this).data('event-title');
    openCancelModal(eventId, eventTitle, this);
  });
}

/**
 * Opens the cancellation confirmation modal.
 * @param {string} eventId
 * @param {string} eventTitle
 * @param {HTMLElement} [triggerEl]
 */
function openCancelModal(eventId, eventTitle, triggerEl = null) {
  pendingCancelEventId = eventId;
  pendingCancelEventTitle = eventTitle;
  $('#modal-event-name').text(eventTitle);
  $('#modal-confirm-btn').prop('disabled', false).text('Yes, Cancel Registration');
  openModal(document.getElementById('cancel-modal'), triggerEl, '#modal-abort-btn');
}

/**
 * Closes the cancellation modal.
 */
function closeModal() {
  pendingCancelEventId = null;
  pendingCancelEventTitle = '';
  closeSharedModal(document.getElementById('cancel-modal'));
}

/**
 * Executes registration cancellation via POST /api/event-registrations/cancel.
 */
async function executeCancellation() {
  if (!pendingCancelEventId) return;

  const $btn = $('#modal-confirm-btn');
  $btn.prop('disabled', true).text('Cancelling…');

  try {
    const res = await api.post('/event-registrations/cancel', {
      event_id: pendingCancelEventId,
    });

    if (res?.status === 200 || res?.data) {
      closeModal();
      showToast(`Registration for "${pendingCancelEventTitle}" has been cancelled.`, 'info');
      await loadRegistrations();
    }
  } catch (err) {
    $btn.prop('disabled', false).text('Yes, Cancel Registration');
    const msg = err?.responseJSON?.message || 'Unable to cancel registration. Please try again.';
    showToast(msg, 'error');
  }
}

