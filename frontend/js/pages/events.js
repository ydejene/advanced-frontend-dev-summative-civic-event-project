/**
 * CivicEvents — Public Events Directory Controller
 *
 * Handles public event discovery, client-side searching, category & timeframe
 * filtering, sorting, responsive card rendering, image fallbacks, and guest states.
 */
import { initShell } from '../components.js';
import { isAuthenticated } from '../auth.js';
import api from '../api.js';
import { formatDateTime, escapeHtml, truncate, getCategoryInfo } from '../utils.js';

// Application state
let allEvents = [];
let debounceTimer = null;

$(function () {
  initShell('events');
  bindFilterEvents();
  ingestUrlParams();
  loadEvents();
});

/**
 * Initializes and binds interactive search and filter controls.
 */
function bindFilterEvents() {
  const $search = $('#event-search-input');
  const $searchClear = $('#search-clear-btn');
  const $category = $('#category-filter');
  const $date = $('#date-filter');
  const $sort = $('#sort-select');

  // Search input debouncing
  $search.on('input', function () {
    const val = $(this).val().trim();
    $searchClear.toggleClass('hidden', !val);

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      applyFiltersAndRender();
      syncUrlParams();
    }, 200);
  });

  // Search clear button
  $searchClear.on('click', function () {
    $search.val('').focus();
    $searchClear.addClass('hidden');
    applyFiltersAndRender();
    syncUrlParams();
  });

  // Category, date, and sort changes
  $category.on('change', () => { applyFiltersAndRender(); syncUrlParams(); });
  $date.on('change', () => { applyFiltersAndRender(); syncUrlParams(); });
  $sort.on('change', () => { applyFiltersAndRender(); syncUrlParams(); });

  // Reset all filters
  $('#clear-all-filters-btn, #empty-clear-btn').on('click', resetFilters);

  // Retry on error
  $('#retry-btn').on('click', loadEvents);

  // Cross-tab authentication listener
  window.addEventListener('auth-state-changed', () => {
    loadEvents();
  });
}

/**
 * Ingests URL query parameters (?search=, ?category=, ?date=) into form controls.
 */
function ingestUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const searchParam = params.get('search');
  const categoryParam = params.get('category');
  const dateParam = params.get('date');

  if (searchParam) {
    $('#event-search-input').val(searchParam);
    $('#search-clear-btn').removeClass('hidden');
  }

  if (categoryParam) {
    const catLower = categoryParam.toLowerCase();
    const $options = $('#category-filter option');
    let matched = false;
    $options.each(function () {
      if ($(this).val().toLowerCase() === catLower) {
        $('#category-filter').val($(this).val());
        matched = true;
      }
    });
    if (!matched) {
      $('#category-filter').val('all');
    }
  }

  if (dateParam) {
    const dateLower = dateParam.toLowerCase();
    if (['all', 'upcoming', 'today', 'this_week', 'past'].includes(dateLower)) {
      $('#date-filter').val(dateLower);
    }
  }

  // Handle auto-focus from header search trigger
  if (params.get('focus') === 'search') {
    setTimeout(() => {
      const $input = $('#event-search-input');
      $input.focus().select();
      $input[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }
}

/**
 * Updates URL search params to reflect current filters without triggering page reloads.
 */
function syncUrlParams() {
  const search = $('#event-search-input').val().trim();
  const category = $('#category-filter').val();
  const date = $('#date-filter').val();

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (category && category !== 'all') params.set('category', category);
  if (date && date !== 'upcoming') params.set('date', date);

  const queryString = params.toString();
  const newRelativePathQuery = window.location.pathname + (queryString ? `?${queryString}` : '');
  window.history.replaceState(null, '', newRelativePathQuery);
}

/**
 * Fetches events from the API or renders guest/login prompt if unauthenticated.
 */
async function loadEvents() {
  const $loading = $('#events-loading');
  const $guestPrompt = $('#guest-prompt-container');
  const $error = $('#events-error');
  const $empty = $('#events-empty');
  const $grid = $('#events-grid');
  const $count = $('#events-count');

  // Reset visibility
  $error.addClass('hidden');
  $empty.addClass('hidden');
  $grid.addClass('hidden');

  // Handle unauthenticated state
  if (!isAuthenticated()) {
    $loading.addClass('hidden');
    $guestPrompt.removeClass('hidden');
    $count.text('Sign in to view events');
    $('#active-filter-chips').addClass('hidden');
    $('#clear-all-filters-btn').addClass('hidden');
    return;
  }

  // Authenticated state: prepare request
  $guestPrompt.addClass('hidden');
  $loading.removeClass('hidden');
  $count.text('Loading events…');

  try {
    const response = await api.get('/events');
    allEvents = Array.isArray(response?.data) ? response.data : [];
    
    $loading.addClass('hidden');
    ingestUrlParams();
    applyFiltersAndRender();
  } catch (err) {
    $loading.addClass('hidden');
    
    // Check if unauthorized (token expired/invalid)
    if (err?.status === 401) {
      $guestPrompt.removeClass('hidden');
      $count.text('Sign in to view events');
      return;
    }

    $error.removeClass('hidden');
    const msg = err?.responseJSON?.message || 'Unable to load events at this time. Please try again later.';
    $('#error-message').text(msg);
    $count.text('Unable to load events');
  }
}

/**
 * Applies client-side filters (text, category, date) and sorting to allEvents.
 */
function applyFiltersAndRender() {
  const searchTerm = $('#event-search-input').val().trim().toLowerCase();
  const selectedCategory = $('#category-filter').val().toLowerCase();
  const selectedDateRange = $('#date-filter').val();
  const selectedSort = $('#sort-select').val();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const endOfWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Filter
  const filtered = allEvents.filter(event => {
    // 1. Text Search (title, description, location)
    if (searchTerm) {
      const title = (event.title || '').toLowerCase();
      const desc = (event.description || '').toLowerCase();
      const loc = (event.location || '').toLowerCase();
      const matchesText = title.includes(searchTerm) || desc.includes(searchTerm) || loc.includes(searchTerm);
      if (!matchesText) return false;
    }

    // 2. Category Filter
    if (selectedCategory && selectedCategory !== 'all') {
      const catInfo = getCategoryInfo(event);
      if (catInfo.category.toLowerCase() !== selectedCategory) {
        return false;
      }
    }

    // 3. Date Timeframe Filter
    const startDate = event.starts_at ? new Date(event.starts_at) : null;
    const endDate = event.ends_at ? new Date(event.ends_at) : startDate;

    if (selectedDateRange === 'upcoming') {
      // Event hasn't ended yet (or starts in future)
      if (endDate && endDate < now) return false;
    } else if (selectedDateRange === 'today') {
      if (!startDate) return false;
      if (startDate < startOfToday || startDate > endOfToday) return false;
    } else if (selectedDateRange === 'this_week') {
      if (!startDate) return false;
      if (startDate < startOfToday || startDate > endOfWeek) return false;
    } else if (selectedDateRange === 'past') {
      if (!endDate || endDate >= now) return false;
    }

    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    if (selectedSort === 'title_asc') {
      return (a.title || '').localeCompare(b.title || '');
    }
    const aDate = a.starts_at ? new Date(a.starts_at).getTime() : 0;
    const bDate = b.starts_at ? new Date(b.starts_at).getTime() : 0;

    if (selectedSort === 'date_desc') {
      return bDate - aDate;
    }
    // Default: date_asc
    return aDate - bDate;
  });

  renderActiveFilterChips();
  renderEventsGrid(filtered);
}

/**
 * Renders active filter chips and toggles the reset button.
 */
function renderActiveFilterChips() {
  const search = $('#event-search-input').val().trim();
  const category = $('#category-filter').val();
  const date = $('#date-filter').val();

  const chips = [];

  if (search) {
    chips.push({
      label: `Search: "${search}"`,
      clear: () => {
        $('#event-search-input').val('');
        $('#search-clear-btn').addClass('hidden');
      }
    });
  }

  if (category && category !== 'all') {
    const catName = $('#category-filter option:selected').text();
    chips.push({
      label: `Category: ${catName}`,
      clear: () => $('#category-filter').val('all')
    });
  }

  if (date && date !== 'upcoming') {
    const dateName = $('#date-filter option:selected').text();
    chips.push({
      label: `Timeframe: ${dateName}`,
      clear: () => $('#date-filter').val('upcoming')
    });
  }

  const $chipsContainer = $('#active-filter-chips');
  const $resetBtn = $('#clear-all-filters-btn');

  if (chips.length > 0) {
    $resetBtn.removeClass('hidden');
    $chipsContainer.removeClass('hidden').html('<span class="text-xs text-gray-500 font-medium">Active filters:</span>');

    chips.forEach(chip => {
      const $chip = $(`
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-soft-mint text-deep-teal">
          <span>${escapeHtml(chip.label)}</span>
          <button type="button" class="hover:text-red-700 focus:outline-none cursor-pointer" aria-label="Remove filter">
            <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </span>
      `);

      $chip.find('button').on('click', () => {
        chip.clear();
        applyFiltersAndRender();
        syncUrlParams();
      });

      $chipsContainer.append($chip);
    });
  } else {
    $resetBtn.addClass('hidden');
    $chipsContainer.addClass('hidden').empty();
  }
}

/**
 * Renders the filtered events grid or appropriate empty state.
 * @param {Array} events - Filtered event objects.
 */
function renderEventsGrid(events) {
  const $grid = $('#events-grid');
  const $empty = $('#events-empty');
  const $count = $('#events-count');

  if (events.length === 0) {
    $grid.addClass('hidden').empty();
    $empty.removeClass('hidden');

    if (allEvents.length === 0) {
      $('#empty-title').text('No Events Scheduled');
      $('#empty-message').text('There are currently no civic events published in the database. Please check back later.');
      $('#empty-clear-btn').addClass('hidden');
    } else {
      $('#empty-title').text('No Matching Events Found');
      $('#empty-message').text('No events match your current search keywords or filters. Try adjusting your search or clearing active filters.');
      $('#empty-clear-btn').removeClass('hidden');
    }

    $count.text('Showing 0 events');
    return;
  }

  $empty.addClass('hidden');
  $grid.removeClass('hidden').empty();
  $count.text(`Showing ${events.length} ${events.length === 1 ? 'event' : 'events'}`);

  events.forEach(event => {
    const catInfo = getCategoryInfo(event);
    const dateFormatted = event.starts_at ? formatDateTime(event.starts_at) : 'Date TBA';
    const locationText = event.location ? escapeHtml(event.location) : 'Location TBA';
    const descriptionText = event.description ? truncate(escapeHtml(event.description), 110) : 'No description provided.';
    const detailUrl = `/pages/events/detail.html?id=${encodeURIComponent(event.id)}`;

    const cardHtml = `
      <article class="card group flex flex-col h-full hover:shadow-md transition-shadow duration-200" aria-label="${escapeHtml(event.title)}">
        <!-- Event Image with fallback handling -->
        <div class="relative h-48 w-full overflow-hidden bg-gray-100">
          <img src="${escapeHtml(catInfo.image)}"
               alt="${escapeHtml(event.title)}"
               loading="lazy"
               class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
               onerror="this.onerror=null;this.src='${catInfo.fallbackImage}';">
          <span class="absolute top-3 left-3 badge-teal text-xs font-semibold shadow-sm">
            ${escapeHtml(catInfo.category)}
          </span>
        </div>

        <!-- Event Body -->
        <div class="p-5 flex-1 flex flex-col justify-between">
          <div>
            <!-- Date/Time Badge -->
            <p class="text-xs font-semibold text-teal flex items-center gap-1.5 mb-1.5">
              <svg class="w-3.5 h-3.5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                   stroke-width="2" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/>
              </svg>
              <span>${escapeHtml(dateFormatted)}</span>
            </p>

            <!-- Event Title -->
            <h3 class="font-heading font-bold text-deep-teal text-lg leading-snug mb-2 group-hover:text-teal transition-colors">
              <a href="${detailUrl}" class="hover:underline">
                ${escapeHtml(event.title)}
              </a>
            </h3>

            <!-- Location -->
            <p class="text-xs text-gray-500 flex items-center gap-1.5 mb-3">
              <svg class="w-3.5 h-3.5 flex-shrink-0 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                   stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"/>
              </svg>
              <span class="truncate">${locationText}</span>
            </p>

            <!-- Description -->
            <p class="text-xs text-gray-600 leading-relaxed mb-4">
              ${descriptionText}
            </p>
          </div>

          <!-- Action Button -->
          <div class="pt-3 border-t border-gray-100 mt-2">
            <a href="${detailUrl}"
               class="btn-secondary text-xs w-full justify-center group-hover:bg-soft-mint transition-colors">
              View Details →
            </a>
          </div>
        </div>
      </article>
    `;

    $grid.append(cardHtml);
  });
}

/**
 * Resets all filter controls and renders unfiltered events.
 */
function resetFilters() {
  $('#event-search-input').val('');
  $('#search-clear-btn').addClass('hidden');
  $('#category-filter').val('all');
  $('#date-filter').val('upcoming');
  $('#sort-select').val('date_asc');

  applyFiltersAndRender();
  syncUrlParams();
}

