/**
 * Homepage initialization — layout and structure only at this stage.
 * API integration is added in later stages.
 */
import { initShell } from '../components.js';

$(function () {
  initShell('home');
  initHeroSearch();
});

/** Binds the hero search form to the events page with a query parameter. */
function initHeroSearch() {
  $('#hero-search-form').on('submit', function (e) {
    e.preventDefault();
    const query = $('#hero-search-input').val().trim();
    if (query) {
      window.location.href = `/pages/events/index.html?search=${encodeURIComponent(query)}`;
    } else {
      window.location.href = '/pages/events/index.html';
    }
  });
}

