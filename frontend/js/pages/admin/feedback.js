/**
 * CivicEvents — Admin Feedback & Attendees Controller
 *
 * Handles:
 *  - Route guard enforcement (requires role === 'admin')
 *  - Event selector loading from GET /api/events
 *  - Attendee roster retrieval via GET /api/event-registrations/event/:event_id/attendees
 *  - Feedback records retrieval via GET /api/event-feedback/event/:event_id
 *  - Metric calculations (average satisfaction, counts)
 *  - Tab toggles and responsive views
 */
import { requireAdmin } from '../../guards.js';
import { initShell } from '../../components.js';
import api from '../../api.js';
import { formatDateTime, formatDate, escapeHtml } from '../../utils.js';

let eventsList = [];
let selectedEventId = '';

const RATING_LABELS = {
  1: '1 - Poor',
  2: '2 - Fair',
  3: '3 - Average',
  4: '4 - Good',
  5: '5 - Excellent',
};

// Enforce admin-only access
if (requireAdmin()) {
  $(function () {
    initShell('admin-feedback');
    bindEvents();
    loadEventsSelector();
  });
}

/**
 * Binds UI event handlers.
 */
function bindEvents() {
  $('#event-select').on('change', function () {
    selectedEventId = $(this).val();
    if (selectedEventId) {
      loadEventAdminData(selectedEventId);
    } else {
      resetView();
    }
  });

  // Tab switching
  $('#tab-btn-feedback').on('click', function () {
    $(this).attr('aria-selected', 'true').removeClass('border-transparent text-gray-500 font-medium').addClass('border-teal text-teal font-semibold');
    $('#tab-btn-attendees').attr('aria-selected', 'false').removeClass('border-teal text-teal font-semibold').addClass('border-transparent text-gray-500 font-medium');
    $('#panel-feedback').removeClass('hidden');
    $('#panel-attendees').addClass('hidden');
  });

  $('#tab-btn-attendees').on('click', function () {
    $(this).attr('aria-selected', 'true').removeClass('border-transparent text-gray-500 font-medium').addClass('border-teal text-teal font-semibold');
    $('#tab-btn-feedback').attr('aria-selected', 'false').removeClass('border-teal text-teal font-semibold').addClass('border-transparent text-gray-500 font-medium');
    $('#panel-attendees').removeClass('hidden');
    $('#panel-feedback').addClass('hidden');
  });

  // Cross-tab synchronization
  window.addEventListener('auth-state-changed', () => {
    if (selectedEventId) {
      loadEventAdminData(selectedEventId);
    }
  });
}

/**
 * Resets the admin view when no event is selected.
 */
function resetView() {
  $('#event-metrics').addClass('hidden');
  $('#admin-data-container').addClass('hidden');
  $('#no-event-selected').removeClass('hidden');
}

/**
 * Fetches events list to populate the selection dropdown.
 */
async function loadEventsSelector() {
  const $select = $('#event-select');
  $select.empty().append('<option value="">Loading events…</option>');

  try {
    const res = await api.get('/events');
    eventsList = Array.isArray(res?.data) ? res.data : [];

    $select.empty();
    if (eventsList.length === 0) {
      $select.append('<option value="">No published events available</option>');
      return;
    }

    $select.append('<option value="">-- Choose an event --</option>');
    eventsList.forEach(event => {
      const dateStr = event.starts_at ? ` (${formatDate(event.starts_at)})` : '';
      $select.append(`<option value="${escapeHtml(event.id)}">${escapeHtml(event.title)}${dateStr}</option>`);
    });

    // Check if URL parameter specifies an event ID (?id=...)
    const params = new URLSearchParams(window.location.search);
    const urlEventId = params.get('id');
    if (urlEventId && eventsList.some(e => e.id === urlEventId)) {
      $select.val(urlEventId).trigger('change');
    }
  } catch {
    $select.empty().append('<option value="">Error loading events</option>');
  }
}

/**
 * Loads attendees and feedback for the chosen event.
 * @param {string} eventId
 */
async function loadEventAdminData(eventId) {
  $('#no-event-selected').addClass('hidden');
  $('#event-metrics').removeClass('hidden');
  $('#admin-data-container').removeClass('hidden');

  await Promise.allSettled([
    loadAttendees(eventId),
    loadFeedback(eventId),
  ]);
}

/**
 * Fetches and renders attendees for the event.
 * @param {string} eventId
 */
async function loadAttendees(eventId) {
  const $loading = $('#attendees-loading');
  const $empty = $('#attendees-empty');
  const $tableWrap = $('#attendees-table-wrap');
  const $tbody = $('#attendees-tbody');
  const $metric = $('#metric-attendees');
  const $tabCount = $('#tab-count-attendees');

  $loading.removeClass('hidden');
  $empty.addClass('hidden');
  $tableWrap.addClass('hidden');

  try {
    const res = await api.get(`/event-registrations/event/${encodeURIComponent(eventId)}/attendees`);
    const attendees = Array.isArray(res?.data) ? res.data : [];

    $loading.addClass('hidden');
    $metric.text(attendees.length);
    $tabCount.text(attendees.length);

    if (attendees.length === 0) {
      $empty.removeClass('hidden');
      return;
    }

    $tbody.empty();
    attendees.forEach(att => {
      const name = escapeHtml(att.full_name || 'Anonymous');
      const email = escapeHtml(att.email || 'N/A');
      const date = att.created_at ? formatDate(att.created_at) : 'N/A';
      $tbody.append(`
        <tr class="hover:bg-gray-50">
          <td class="p-3 font-semibold text-gray-900">${name}</td>
          <td class="p-3 text-gray-600">${email}</td>
          <td class="p-3">
            <span class="badge-success text-xs font-semibold">Confirmed</span>
          </td>
          <td class="p-3 text-gray-500">${date}</td>
        </tr>
      `);
    });

    $tableWrap.removeClass('hidden');
  } catch {
    $loading.addClass('hidden');
    $empty.text('Unable to retrieve attendee roster. Please ensure administrative authorization.').removeClass('hidden');
  }
}

/**
 * Fetches and renders feedback records for the event.
 * @param {string} eventId
 */
async function loadFeedback(eventId) {
  const $loading = $('#feedback-loading');
  const $empty = $('#feedback-empty');
  const $list = $('#feedback-records-list');
  const $metricCount = $('#metric-feedback-count');
  const $metricAvg = $('#metric-avg-rating');
  const $metricStars = $('#metric-avg-stars');
  const $tabCount = $('#tab-count-feedback');

  $loading.removeClass('hidden');
  $empty.addClass('hidden');
  $list.addClass('hidden');

  try {
    const res = await api.get(`/event-feedback/event/${encodeURIComponent(eventId)}`);
    const feedbacks = Array.isArray(res?.data) ? res.data : [];

    $loading.addClass('hidden');
    $metricCount.text(feedbacks.length);
    $tabCount.text(feedbacks.length);

    if (feedbacks.length === 0) {
      $metricAvg.text('--');
      $metricStars.empty();
      $empty.removeClass('hidden');
      return;
    }

    // Calculate average
    const totalRating = feedbacks.reduce((acc, curr) => acc + (Number(curr.rating) || 0), 0);
    const avg = (totalRating / feedbacks.length).toFixed(1);
    $metricAvg.text(avg);

    $metricStars.empty();
    const roundedAvg = Math.round(Number(avg));
    for (let i = 1; i <= 5; i++) {
      const fillClass = i <= roundedAvg ? 'text-warm-amber' : 'text-gray-300';
      $metricStars.append(`
        <svg class="w-4 h-4 ${fillClass} fill-current" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      `);
    }

    $list.empty();
    feedbacks.forEach(fb => {
      const name = escapeHtml(fb.full_name || 'Anonymous Community Member');
      const email = escapeHtml(fb.email || '');
      const comment = fb.comment?.trim() ? escapeHtml(fb.comment) : 'No comment provided.';
      const date = fb.created_at ? formatDateTime(fb.created_at) : '';
      const rating = fb.rating || 5;

      let starSvgs = '';
      for (let i = 1; i <= 5; i++) {
        const fillClass = i <= rating ? 'text-warm-amber' : 'text-gray-300';
        starSvgs += `
          <svg class="w-4 h-4 ${fillClass} fill-current" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
          </svg>
        `;
      }

      $list.append(`
        <article class="card p-5 bg-white space-y-2 border border-gray-200">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div class="flex items-center gap-2">
              <span class="font-heading font-semibold text-deep-teal text-sm">${name}</span>
              ${email ? `<span class="text-xs text-gray-400">(${email})</span>` : ''}
            </div>
            <span class="text-[11px] text-gray-400">${date}</span>
          </div>

          <div class="flex items-center gap-1.5">
            <div class="flex">${starSvgs}</div>
            <span class="text-xs font-medium text-gray-700">${RATING_LABELS[rating] || `${rating} Stars`}</span>
          </div>

          <p class="text-xs sm:text-sm text-gray-700 whitespace-pre-line leading-relaxed pt-1">
            ${comment}
          </p>
        </article>
      `);
    });

    $list.removeClass('hidden');
  } catch {
    $loading.addClass('hidden');
    $empty.text('Unable to retrieve feedback records. Please ensure administrative authorization.').removeClass('hidden');
  }
}

