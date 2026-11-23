/**
 * CivicEvents — Public Event Detail Controller (Stage 4)
 *
 * Handles:
 *  - Event details presentation and category image fallbacks
 *  - Event registration and cancellation (user)
 *  - Cancellation constraint & re-registration limitation handling
 *  - Attendee feedback submission & updating (user)
 *  - Administrator attendee roster & feedback overview (admin-only)
 *  - Cross-tab session synchronization
 */
import { initShell } from '../components.js';
import { isAuthenticated, isAdmin } from '../auth.js';
import api from '../api.js';
import { formatDateTime, formatDate, escapeHtml, showToast, getCategoryInfo } from '../utils.js';

let currentEventId = '';
let currentEvent = null;
let currentRegistration = null;
let userFeedbackRecord = null;
let isEditMode = false;

const RATING_LABELS = {
  1: '1 - Poor',
  2: '2 - Fair',
  3: '3 - Average',
  4: '4 - Good',
  5: '5 - Excellent',
};

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

  // Registration interactions
  $('#register-event-btn').on('click', handleRegisterEvent);
  $('#start-cancel-reg-btn').on('click', () => {
    $('#reg-cancel-confirm-box').removeClass('hidden');
    $('#reg-cancel-trigger-wrap').addClass('hidden');
  });
  $('#abort-cancel-reg-btn').on('click', () => {
    $('#reg-cancel-confirm-box').addClass('hidden');
    $('#reg-cancel-trigger-wrap').removeClass('hidden');
  });
  $('#confirm-cancel-reg-btn').on('click', handleCancelRegistration);

  // Feedback star selection
  $('.star-rating-btn').on('click', function () {
    const rating = parseInt($(this).data('rating'), 10);
    setStarRating(rating);
  });

  // Feedback comment character count
  $('#feedback-comment').on('input', function () {
    const len = $(this).val().length;
    $('#feedback-char-count').text(`${len} / 1000`);
    if (len > 0) {
      $('#comment-error').addClass('hidden');
    }
  });

  // Feedback form submit
  $('#event-feedback-form').on('submit', handleFeedbackSubmit);

  // Feedback edit toggle
  $('#edit-feedback-btn').on('click', () => {
    enterFeedbackEditMode();
  });
  $('#cancel-edit-feedback-btn').on('click', () => {
    exitFeedbackEditMode();
  });

  // Admin tabs toggle
  $('#admin-tab-attendees').on('click', function () {
    $(this).attr('aria-selected', 'true').removeClass('border-transparent text-gray-500').addClass('border-teal text-teal');
    $('#admin-tab-feedback').attr('aria-selected', 'false').removeClass('border-teal text-teal').addClass('border-transparent text-gray-500');
    $('#admin-panel-attendees').removeClass('hidden');
    $('#admin-panel-feedback').addClass('hidden');
  });

  $('#admin-tab-feedback').on('click', function () {
    $(this).attr('aria-selected', 'true').removeClass('border-transparent text-gray-500').addClass('border-teal text-teal');
    $('#admin-tab-attendees').attr('aria-selected', 'false').removeClass('border-teal text-teal').addClass('border-transparent text-gray-500');
    $('#admin-panel-feedback').removeClass('hidden');
    $('#admin-panel-attendees').addClass('hidden');
  });

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
    currentEvent = response?.data;

    if (!currentEvent || !currentEvent.id) {
      showErrorState(404, 'The requested event could not be found.');
      return;
    }

    renderEventDetail(currentEvent);

    // Concurrently load registration status, user feedback, and admin panels
    await Promise.allSettled([
      loadUserRegistrationStatus(),
      loadUserFeedback(),
      loadAdminPanelsIfAuthorized(),
    ]);

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

/* ==========================================================================
   Stage 4: Registration Functionality
   ========================================================================== */

/**
 * Loads registration status for the current user and event.
 */
async function loadUserRegistrationStatus() {
  const $guest = $('#reg-view-guest');
  const $available = $('#reg-view-available');
  const $registered = $('#reg-view-registered');
  const $cancelled = $('#reg-view-cancelled');
  const $past = $('#reg-view-past');
  const $alert = $('#registration-alert');

  // Hide all views first
  $guest.addClass('hidden');
  $available.addClass('hidden');
  $registered.addClass('hidden');
  $cancelled.addClass('hidden');
  $past.addClass('hidden');
  $alert.addClass('hidden').empty();

  // Reset button state
  $('#register-event-btn').prop('disabled', false).text('Register for Event');
  $('#confirm-cancel-reg-btn').prop('disabled', false).text('Yes, Cancel');

  if (!isAuthenticated()) {
    const redirectUrl = encodeURIComponent(window.location.pathname + window.location.search);
    $('#reg-guest-login-btn').attr('href', `/pages/auth/login.html?redirect=${redirectUrl}`);
    $guest.removeClass('hidden');
    return;
  }

  // Check if event is in the past
  const now = new Date();
  const startsAt = currentEvent?.starts_at ? new Date(currentEvent.starts_at) : null;
  const endsAt = currentEvent?.ends_at ? new Date(currentEvent.ends_at) : startsAt;
  const isPast = endsAt && endsAt < now;

  try {
    const res = await api.get('/event-registrations/my-registrations');
    const registrations = Array.isArray(res?.data) ? res.data : [];
    currentRegistration = registrations.find(r => r.event_id === currentEventId);

    if (currentRegistration) {
      if (currentRegistration.status === 'registered') {
        $registered.removeClass('hidden');
        const regDate = currentRegistration.created_at ? formatDate(currentRegistration.created_at) : 'recently';
        $('#reg-confirmed-date').text(`Confirmed on ${regDate}. Your spot is reserved.`);
        $('#reg-cancel-confirm-box').addClass('hidden');
        $('#reg-cancel-trigger-wrap').removeClass('hidden');
      } else if (currentRegistration.status === 'cancelled') {
        $cancelled.removeClass('hidden');
      } else {
        $available.removeClass('hidden');
      }
    } else {
      if (isPast) {
        $past.removeClass('hidden');
      } else {
        $available.removeClass('hidden');
      }
    }
  } catch {
    // If fetching registrations fails, show default view based on event timeframe
    if (isPast) {
      $past.removeClass('hidden');
    } else {
      $available.removeClass('hidden');
    }
  }
}

/**
 * Handles registering for the event.
 */
async function handleRegisterEvent() {
  const $btn = $('#register-event-btn');
  const $alert = $('#registration-alert');

  $btn.prop('disabled', true).text('Registering…');
  $alert.addClass('hidden').empty();

  try {
    const res = await api.post('/event-registrations/register', { event_id: currentEventId });
    if (res?.status === 201 || res?.data) {
      showToast('Registration confirmed! You are registered for this event.', 'success');
      await loadUserRegistrationStatus();
      if (isAdmin()) {
        loadAdminAttendees();
      }
    }
  } catch (err) {
    $btn.prop('disabled', false).text('Register for Event');
    const status = err?.status;
    const msg = err?.responseJSON?.message || '';

    $alert.removeClass('hidden bg-green-50 text-green-800 bg-red-50 text-red-800 bg-amber-50 text-amber-800');

    if (status === 409) {
      // Backend known limitation: UNIQUE constraint prevents re-enrolling after cancellation
      $alert.addClass('bg-amber-50 text-amber-900 border border-amber-200');
      $alert.html(`
        <strong>Registration notice:</strong> The system indicates this account already has a record for this event. 
        If you previously cancelled, the database constraint prevents re-registration.
      `);
    } else if (status === 401) {
      $alert.addClass('bg-red-50 text-red-800 border border-red-200').text('Your session has expired. Please log in again.');
    } else {
      $alert.addClass('bg-red-50 text-red-800 border border-red-200').text(msg || 'Unable to complete registration. Please try again.');
    }
  }
}

/**
 * Handles cancelling the active event registration.
 */
async function handleCancelRegistration() {
  const $confirmBtn = $('#confirm-cancel-reg-btn');
  const $alert = $('#registration-alert');

  $confirmBtn.prop('disabled', true).text('Cancelling…');

  try {
    const res = await api.post('/event-registrations/cancel', { event_id: currentEventId });
    if (res?.status === 200 || res?.data) {
      showToast('Your registration has been cancelled.', 'info');
      await loadUserRegistrationStatus();
      if (isAdmin()) {
        loadAdminAttendees();
      }
    }
  } catch (err) {
    $confirmBtn.prop('disabled', false).text('Yes, Cancel');
    const msg = err?.responseJSON?.message || 'Unable to cancel registration at this time. Please try again.';
    $alert.removeClass('hidden')
      .addClass('bg-red-50 text-red-800 border border-red-200')
      .text(msg);
  }
}

/* ==========================================================================
   Stage 4: Feedback Functionality
   ========================================================================== */

/**
 * Loads user feedback state.
 */
async function loadUserFeedback() {
  const $guestView = $('#feedback-guest-view');
  const $display = $('#user-feedback-display');
  const $formContainer = $('#feedback-form-container');

  $guestView.addClass('hidden');
  $display.addClass('hidden');
  $formContainer.removeClass('hidden');

  if (!isAuthenticated()) {
    $guestView.removeClass('hidden');
    $formContainer.addClass('hidden');
    const redirectUrl = encodeURIComponent(window.location.pathname + window.location.search);
    $guestView.find('a').attr('href', `/pages/auth/login.html?redirect=${redirectUrl}`);
    return;
  }

  try {
    const res = await api.get('/event-feedback/my-feedback');
    const feedbacks = Array.isArray(res?.data) ? res.data : [];
    userFeedbackRecord = feedbacks.find(f => f.event_id === currentEventId);

    if (userFeedbackRecord) {
      renderExistingFeedback(userFeedbackRecord);
    } else {
      resetFeedbackForm();
    }
  } catch {
    resetFeedbackForm();
  }
}

/**
 * Displays existing feedback submitted by the user.
 * @param {Object} feedback
 */
function renderExistingFeedback(feedback) {
  const $display = $('#user-feedback-display');
  const $formContainer = $('#feedback-form-container');
  const $starsContainer = $('#user-feedback-stars');

  $starsContainer.empty();
  const rating = feedback.rating || 5;

  for (let i = 1; i <= 5; i++) {
    const fillClass = i <= rating ? 'text-warm-amber' : 'text-gray-300';
    $starsContainer.append(`
      <svg class="w-5 h-5 ${fillClass} fill-current" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
      </svg>
    `);
  }
  $starsContainer.append(`<span class="text-xs font-semibold text-gray-700 ml-1.5">${RATING_LABELS[rating] || `${rating} Stars`}</span>`);

  const commentText = feedback.comment?.trim() ? escapeHtml(feedback.comment) : 'No comment provided.';
  $('#user-feedback-comment').html(commentText);

  const dateText = feedback.created_at ? `Submitted on ${formatDateTime(feedback.created_at)}` : '';
  $('#user-feedback-date').text(dateText);

  $display.removeClass('hidden');
  $formContainer.addClass('hidden');
}

/**
 * Sets the star rating in the feedback form.
 * @param {number} rating
 */
function setStarRating(rating) {
  $('#selected-rating').val(rating);
  $('#rating-error').addClass('hidden');

  $('.star-rating-btn').each(function () {
    const starVal = parseInt($(this).data('rating'), 10);
    if (starVal <= rating) {
      $(this).removeClass('text-gray-300').addClass('text-warm-amber');
    } else {
      $(this).removeClass('text-warm-amber').addClass('text-gray-300');
    }
  });

  $('#star-rating-text').text(RATING_LABELS[rating] || `${rating} Stars`);
}

/**
 * Resets the feedback form to fresh state.
 */
function resetFeedbackForm() {
  isEditMode = false;
  $('#selected-rating').val('');
  $('#feedback-comment').val('');
  $('#feedback-char-count').text('0 / 1000');
  $('.star-rating-btn').removeClass('text-warm-amber').addClass('text-gray-300');
  $('#star-rating-text').text('Select a rating');
  $('#feedback-form-alert').addClass('hidden').empty();
  $('#rating-error').addClass('hidden');
  $('#comment-error').addClass('hidden');
  $('#cancel-edit-feedback-btn').addClass('hidden');
  $('#submit-feedback-btn').text('Submit Feedback').prop('disabled', false);
}

/**
 * Enters edit mode for existing feedback.
 */
function enterFeedbackEditMode() {
  if (!userFeedbackRecord) return;
  isEditMode = true;
  setStarRating(userFeedbackRecord.rating || 5);
  $('#feedback-comment').val(userFeedbackRecord.comment || '');
  $('#feedback-char-count').text(`${(userFeedbackRecord.comment || '').length} / 1000`);
  $('#cancel-edit-feedback-btn').removeClass('hidden');
  $('#submit-feedback-btn').text('Update Feedback').prop('disabled', false);
  $('#user-feedback-display').addClass('hidden');
  $('#feedback-form-container').removeClass('hidden');
}

/**
 * Exits edit mode and restores the existing feedback display.
 */
function exitFeedbackEditMode() {
  isEditMode = false;
  $('#feedback-form-container').addClass('hidden');
  $('#user-feedback-display').removeClass('hidden');
}

/**
 * Handles feedback submission (Create or Update).
 * @param {Event} e
 */
async function handleFeedbackSubmit(e) {
  e.preventDefault();

  const ratingVal = parseInt($('#selected-rating').val(), 10);
  const commentVal = $('#feedback-comment').val().trim();
  const $alert = $('#feedback-form-alert');
  const $submitBtn = $('#submit-feedback-btn');

  $alert.addClass('hidden').empty();

  // Validate rating
  if (!ratingVal || ratingVal < 1 || ratingVal > 5) {
    $('#rating-error').text('Please select a star rating from 1 to 5.').removeClass('hidden');
    return;
  }
  $('#rating-error').addClass('hidden');

  $submitBtn.prop('disabled', true).text(isEditMode ? 'Updating…' : 'Submitting…');

  try {
    if (isEditMode && userFeedbackRecord?.id) {
      // PUT /api/event-feedback/:id
      const res = await api.put(`/event-feedback/${encodeURIComponent(userFeedbackRecord.id)}`, {
        rating: ratingVal,
        comment: commentVal,
      });

      if (res?.data) {
        userFeedbackRecord = res.data;
        showToast('Feedback updated successfully.', 'success');
        renderExistingFeedback(userFeedbackRecord);
        if (isAdmin()) {
          loadAdminFeedback();
        }
      }
    } else {
      // POST /api/event-feedback
      const res = await api.post('/event-feedback', {
        event_id: currentEventId,
        rating: ratingVal,
        comment: commentVal,
      });

      if (res?.data) {
        userFeedbackRecord = res.data;
        showToast('Thank you! Your feedback has been submitted.', 'success');
        renderExistingFeedback(userFeedbackRecord);
        if (isAdmin()) {
          loadAdminFeedback();
        }
      }
    }
  } catch (err) {
    $submitBtn.prop('disabled', false).text(isEditMode ? 'Update Feedback' : 'Submit Feedback');
    const status = err?.status;
    const msg = err?.responseJSON?.message || '';

    $alert.removeClass('hidden bg-red-50 text-red-800 bg-amber-50 text-amber-800');

    if (status === 409) {
      $alert.addClass('bg-amber-50 text-amber-800 border border-amber-200')
        .text('You have already submitted feedback for this event. Use the edit option to make changes.');
    } else {
      $alert.addClass('bg-red-50 text-red-800 border border-red-200')
        .text(msg || 'Unable to submit feedback. Please try again.');
    }
  }
}

/* ==========================================================================
   Stage 4: Administrator Overview (Attendees & Feedback)
   ========================================================================== */

/**
 * Initializes and loads admin panels if the logged in user is an administrator.
 */
async function loadAdminPanelsIfAuthorized() {
  const $section = $('#admin-management-section');
  if (!isAdmin()) {
    $section.addClass('hidden');
    return;
  }

  $section.removeClass('hidden');
  await Promise.allSettled([
    loadAdminAttendees(),
    loadAdminFeedback(),
  ]);
}

/**
 * Fetches and renders attendees for the administrator.
 */
async function loadAdminAttendees() {
  const $loading = $('#admin-attendees-loading');
  const $empty = $('#admin-attendees-empty');
  const $tableWrap = $('#admin-attendees-table-wrap');
  const $tbody = $('#admin-attendees-tbody');
  const $count = $('#admin-attendees-count');

  $loading.removeClass('hidden');
  $empty.addClass('hidden');
  $tableWrap.addClass('hidden');

  try {
    const res = await api.get(`/event-registrations/event/${encodeURIComponent(currentEventId)}/attendees`);
    const attendees = Array.isArray(res?.data) ? res.data : [];

    $loading.addClass('hidden');
    $count.text(attendees.length);

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
          <td class="p-2.5 font-medium text-gray-900">${name}</td>
          <td class="p-2.5 text-gray-600">${email}</td>
          <td class="p-2.5">
            <span class="badge-success text-[10px] font-semibold">Confirmed</span>
          </td>
          <td class="p-2.5 text-gray-500">${date}</td>
        </tr>
      `);
    });

    $tableWrap.removeClass('hidden');
  } catch {
    $loading.addClass('hidden');
    $empty.text('Unable to retrieve attendee list. Please check administrative privileges.').removeClass('hidden');
  }
}

/**
 * Fetches and renders feedback records for the administrator.
 */
async function loadAdminFeedback() {
  const $loading = $('#admin-feedback-loading');
  const $empty = $('#admin-feedback-empty');
  const $listWrap = $('#admin-feedback-list-wrap');
  const $cards = $('#admin-feedback-cards');
  const $count = $('#admin-feedback-count');
  const $avgRating = $('#admin-avg-rating');
  const $avgStars = $('#admin-avg-stars');

  $loading.removeClass('hidden');
  $empty.addClass('hidden');
  $listWrap.addClass('hidden');

  try {
    const res = await api.get(`/event-feedback/event/${encodeURIComponent(currentEventId)}`);
    const feedbacks = Array.isArray(res?.data) ? res.data : [];

    $loading.addClass('hidden');
    $count.text(feedbacks.length);

    if (feedbacks.length === 0) {
      $empty.removeClass('hidden');
      return;
    }

    // Compute average rating
    const totalRating = feedbacks.reduce((acc, curr) => acc + (Number(curr.rating) || 0), 0);
    const avg = (totalRating / feedbacks.length).toFixed(1);
    $avgRating.text(`${avg} / 5.0`);

    $avgStars.empty();
    const roundedAvg = Math.round(Number(avg));
    for (let i = 1; i <= 5; i++) {
      const fillClass = i <= roundedAvg ? 'text-warm-amber' : 'text-gray-300';
      $avgStars.append(`
        <svg class="w-4 h-4 ${fillClass} fill-current" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      `);
    }

    $cards.empty();
    feedbacks.forEach(fb => {
      const name = escapeHtml(fb.full_name || 'Anonymous');
      const email = escapeHtml(fb.email || '');
      const comment = fb.comment?.trim() ? escapeHtml(fb.comment) : 'No comment provided.';
      const date = fb.created_at ? formatDateTime(fb.created_at) : '';
      const rating = fb.rating || 5;

      let starSvgs = '';
      for (let i = 1; i <= 5; i++) {
        const fillClass = i <= rating ? 'text-warm-amber' : 'text-gray-300';
        starSvgs += `
          <svg class="w-3.5 h-3.5 ${fillClass} fill-current" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
          </svg>
        `;
      }

      $cards.append(`
        <div class="p-3.5 rounded-lg border border-gray-100 bg-gray-50/70 space-y-1.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold text-gray-900">${name}</span>
              ${email ? `<span class="text-[11px] text-gray-400">(${email})</span>` : ''}
            </div>
            <span class="text-[11px] text-gray-400">${date}</span>
          </div>
          <div class="flex items-center gap-1">
            ${starSvgs}
            <span class="text-[11px] font-medium text-gray-600 ml-1">${RATING_LABELS[rating] || `${rating} Stars`}</span>
          </div>
          <p class="text-xs text-gray-700 whitespace-pre-line mt-1">${comment}</p>
        </div>
      `);
    });

    $listWrap.removeClass('hidden');
  } catch {
    $loading.addClass('hidden');
    $empty.text('Unable to retrieve feedback records. Please check administrative privileges.').removeClass('hidden');
  }
}
