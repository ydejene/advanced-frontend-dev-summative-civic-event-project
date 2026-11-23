/**
 * CivicEvents — Public Event Detail Controller
 *
 * Fetches and displays full details for a single civic event identified by the
 * ?id= query parameter. Handles 404s, missing IDs, guest authentication gates,
 * image fallbacks, and responsive layout presentation.
 */
import { initShell } from '../components.js';
import { isAuthenticated } from '../auth.js';
import api from '../api.js';
import { formatDateTime, escapeHtml, getCategoryInfo } from '../utils.js';

let currentEventId = '';

$(function () {
  initShell('events');
  parseEventId();
  bindEvents();
  loadEventDetail();
});

/**
 * Extracts and validates the event id from the query string.
 */
function parseEventId() {
  const params = new URLSearchParams(window.location.search);
  currentEventId = params.get('id')?.trim() || '';
}

/**
 * Binds UI interaction handlers.
 */
function bindEvents() {
  $('#retry-btn').on('click', loadEventDetail);

  // Cross-tab synchronization
  window.addEventListener('auth-state-changed', () => {
    loadEventDetail();
  });
}

/**
 * Fetches event data from GET /api/events/:id or shows appropriate empty/auth states.
 */
async function loadEventDetail() {
  const $loading = $('#event-loading');
  const $guestPrompt = $('#guest-prompt-container');
  const $error = $('#event-error');
  const $content = $('#event-content');
  const $retryBtn = $('#retry-btn');

  // Reset visibility
  $content.addClass('hidden');
  $error.addClass('hidden');
  $retryBtn.addClass('hidden');

  // 1. Missing Event ID check
  if (!currentEventId) {
    $loading.addClass('hidden');
    $error.removeClass('hidden');
    $('#error-title').text('Invalid Event Link');
    $('#error-message').text('No event identifier was provided in the page address. Please return to the events calendar.');
    document.title = 'Event Not Found — CivicEvents';
    return;
  }

  // 2. Guest / Unauthenticated check
  if (!isAuthenticated()) {
    $loading.addClass('hidden');
    $guestPrompt.removeClass('hidden');
    const redirectUrl = encodeURIComponent(window.location.pathname + window.location.search);
    $('#guest-login-link').attr('href', `/pages/auth/login.html?redirect=${redirectUrl}`);
    return;
  }

  // 3. Authenticated: Fetch event details
  $guestPrompt.addClass('hidden');
  $loading.removeClass('hidden');

  try {
    const response = await api.get(`/events/${encodeURIComponent(currentEventId)}`);
    const event = response?.data;

    if (!event || !event.id) {
      showErrorState(404, 'The requested event could not be found.');
      return;
    }

    renderEventDetail(event);
  } catch (err) {
    $loading.addClass('hidden');

    const status = err?.status;
    if (status === 401) {
      $guestPrompt.removeClass('hidden');
      return;
    }

    if (status === 404) {
      showErrorState(404, 'The event you requested may have been removed or does not exist.');
    } else {
      const msg = err?.responseJSON?.message || 'Unable to communicate with the civic event server. Please try again.';
      showErrorState(status || 500, msg, true);
    }
  }
}

/**
 * Displays an error banner for invalid, not-found, or server failure states.
 * @param {number} status
 * @param {string} message
 * @param {boolean} [canRetry=false]
 */
function showErrorState(status, message, canRetry = false) {
  $('#event-loading').addClass('hidden');
  $('#event-content').addClass('hidden');
  $('#guest-prompt-container').addClass('hidden');

  const $error = $('#event-error');
  $error.removeClass('hidden');

  if (status === 404) {
    $('#error-title').text('Event Not Found');
    document.title = 'Event Not Found — CivicEvents';
  } else {
    $('#error-title').text('Unable to Load Event');
  }

  $('#error-message').text(message);

  if (canRetry) {
    $('#retry-btn').removeClass('hidden');
  }
}

/**
 * Renders the fetched event details into the DOM.
 * @param {Object} event - Event record.
 */
function renderEventDetail(event) {
  const catInfo = getCategoryInfo(event);

  // Update page title and breadcrumbs
  document.title = `${event.title} — CivicEvents`;
  $('#breadcrumb-title').text(event.title);
  $('#event-title').text(event.title);

  // Category & Status Badges
  $('#event-category-badge').text(catInfo.category);

  const now = new Date();
  const startsAt = event.starts_at ? new Date(event.starts_at) : null;
  const endsAt = event.ends_at ? new Date(event.ends_at) : startsAt;

  if (endsAt && endsAt < now) {
    $('#event-status-badge')
      .text('Past Event')
      .attr('class', 'badge bg-gray-100 text-gray-600 text-xs');
  } else {
    $('#event-status-badge')
      .text('Upcoming')
      .attr('class', 'badge bg-green-100 text-green-800 text-xs');
  }

  // Hero Image with fallback handler
  const $image = $('#event-image');
  $image
    .attr('src', catInfo.image)
    .attr('alt', event.title)
    .off('error')
    .on('error', function () {
      $(this).attr('src', catInfo.fallbackImage);
    });

  // Description (safely escaped, preserved linebreaks)
  const descRaw = event.description || 'No detailed description provided for this event.';
  const descParagraphs = descRaw
    .split(/\n\s*\n/)
    .map(p => `<p>${escapeHtml(p.trim())}</p>`)
    .join('');
  $('#event-description').html(descParagraphs);

  // Date & Time
  const startTimeText = event.starts_at ? formatDateTime(event.starts_at) : 'Date & Time TBA';
  $('#event-start-time').text(startTimeText);

  if (event.ends_at) {
    $('#event-end-time')
      .text(`Ends: ${formatDateTime(event.ends_at)}`)
      .removeClass('hidden');
  } else {
    $('#event-end-time').addClass('hidden');
  }

  // Location
  const locText = event.location ? event.location : 'Location to be announced';
  $('#event-location').text(locText);

  // Reveal content
  $('#event-loading').addClass('hidden');
  $('#event-error').addClass('hidden');
  $('#event-content').removeClass('hidden');
}

