/**
 * Service Requests Client-Side Storage Module
 * Manages browser localStorage persistence for community service requests.
 *
 * NOTE: The backend does not provide service request tables or endpoints.
 * This module operates strictly on client-side localStorage for demonstration purposes.
 * Requests are stored locally per browser profile and are not submitted to a remote server.
 *
 * IMPORTANT TECHNICAL & SECURITY LIMITATIONS:
 * 1. Storage boundary: Browser-side localStorage does not constitute a genuine security boundary.
 *    Any person with access to the current browser profile can view or modify stored records
 *    via browser developer tools. UI-level ownership filtering provides scoped views for users,
 *    while page route guards enforce role-based access to admin consoles.
 * 2. Data Minimization: Records store only minimal submitter identity attributes (user_id,
 *    user_name, user_email) strictly necessary for administrative identification and ticket triage.
 *    No credentials, session tokens, or unnecessary personal attributes are stored.
 * 3. Persistence: Clearing this site's local storage or site data removes locally stored requests.
 */

export const STORAGE_KEY = 'civicevents_service_requests';

/**
 * Standard municipal service categories derived from backend/src/utils/serviceTypes.js
 */
export const SERVICE_TYPES = [
  'Road Repair',
  'Sanitation',
  'Street Light Issue',
  'Public Event Support',
  'Water Supply Issue',
  'General Complaint'
];

/**
 * Permitted status lifecycle for service requests
 */
export const STATUS_TYPES = [
  'Submitted',
  'In Review',
  'Resolved',
  'Rejected'
];

/**
 * Checks whether localStorage is supported and accessible in the current browser.
 * @returns {boolean}
 */
export function isStorageAvailable() {
  try {
    const testKey = '__civic_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Retrieves all stored service requests from localStorage.
 * Safely parses JSON and validates record structures.
 * @returns {Array<Object>}
 */
function getRawRequests() {
  if (!isStorageAvailable()) return [];

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];

    // Filter to valid objects with required fields
    return parsed.filter(item => (
      item &&
      typeof item === 'object' &&
      typeof item.id === 'string' &&
      typeof item.user_id === 'string' &&
      typeof item.title === 'string'
    ));
  } catch (err) {
    console.warn('Failed to parse service requests from localStorage:', err);
    return [];
  }
}

/**
 * Persists service requests array to localStorage.
 * @param {Array<Object>} requests
 * @returns {boolean} True if successfully stored
 */
function saveRawRequests(requests) {
  if (!isStorageAvailable()) return false;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
    return true;
  } catch (err) {
    console.error('Failed to save service requests to localStorage:', err);
    return false;
  }
}

/**
 * Generates a human-friendly unique service request tracking ID.
 * @returns {string} E.g. "SR-17324-4K9B"
 */
function generateRequestId() {
  const timePart = Date.now().toString(36).toUpperCase().slice(-5);
  const randPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SR-${timePart}-${randPart}`;
}

/**
 * Retrieves all requests belonging to a specific authenticated user for UI scoping.
 * Note: Provides user-level presentation scoping within the browser session.
 * Sorted by creation timestamp descending.
 * @param {string} userId
 * @returns {Array<Object>}
 */
export function getUserRequests(userId) {
  if (!userId) return [];
  const all = getRawRequests();
  return all
    .filter(req => String(req.user_id) === String(userId))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/**
 * Retrieves all locally stored requests across all submitters.
 * Intended for administrator review consoles (protected by requireAdmin()).
 * Sorted by creation timestamp descending.
 * @returns {Array<Object>}
 */
export function getAllRequests() {
  const all = getRawRequests();
  return all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/**
 * Retrieves a single request by its unique identifier.
 * @param {string} id
 * @returns {Object|null}
 */
export function getRequestById(id) {
  if (!id) return null;
  const all = getRawRequests();
  return all.find(r => r.id === id) || null;
}

/**
 * Creates and persists a new service request record.
 * @param {Object} data - Form data
 * @param {string} data.category - Service category from SERVICE_TYPES
 * @param {string} data.title - Request title/subject
 * @param {string} data.description - Detailed description
 * @param {string} [data.location] - Street address or location
 * @param {Object} user - Current authenticated user session
 * @returns {{ success: boolean, request?: Object, error?: string }}
 */
export function createRequest(data, user) {
  if (!user || !user.id) {
    return { success: false, error: 'You must be logged in to submit a service request.' };
  }

  const category = (data.category || '').trim();
  const title = (data.title || '').trim();
  const description = (data.description || '').trim();
  const location = (data.location || '').trim();

  // Validation
  if (!category || !SERVICE_TYPES.includes(category)) {
    return { success: false, error: 'Please select a valid service category.' };
  }

  if (!title || title.length < 3) {
    return { success: false, error: 'Request title must be at least 3 characters.' };
  }
  if (title.length > 120) {
    return { success: false, error: 'Request title cannot exceed 120 characters.' };
  }

  if (!description || description.length < 10) {
    return { success: false, error: 'Please provide a detailed description (minimum 10 characters).' };
  }
  if (description.length > 2000) {
    return { success: false, error: 'Description cannot exceed 2000 characters.' };
  }

  if (location.length > 200) {
    return { success: false, error: 'Location cannot exceed 200 characters.' };
  }

  const now = new Date().toISOString();
  const newRequest = {
    id: generateRequestId(),
    user_id: user.id,
    user_name: user.full_name || 'Resident',
    user_email: user.email || '',
    category,
    title,
    description,
    location: location || null,
    status: 'Submitted',
    status_notes: '',
    created_at: now,
    updated_at: now
  };

  const all = getRawRequests();
  all.unshift(newRequest);

  const saved = saveRawRequests(all);
  if (!saved) {
    return { success: false, error: 'Unable to save service request to browser storage. Please check storage permissions.' };
  }

  return { success: true, request: newRequest };
}

/**
 * Updates the lifecycle status and optional resolution notes for a request.
 * @param {string} id
 * @param {string} newStatus - One of STATUS_TYPES
 * @param {string} [notes] - Optional administrative note
 * @returns {{ success: boolean, request?: Object, error?: string }}
 */
export function updateRequestStatus(id, newStatus, notes = '') {
  if (!STATUS_TYPES.includes(newStatus)) {
    return { success: false, error: `Invalid status: ${newStatus}` };
  }

  const all = getRawRequests();
  const index = all.findIndex(r => r.id === id);

  if (index === -1) {
    return { success: false, error: 'Service request record not found.' };
  }

  const now = new Date().toISOString();
  all[index].status = newStatus;
  all[index].updated_at = now;
  all[index].status_notes = typeof notes === 'string' ? notes.trim() : '';

  const saved = saveRawRequests(all);
  if (!saved) {
    return { success: false, error: 'Failed to persist status change to browser storage.' };
  }

  return { success: true, request: all[index] };
}

/**
 * Deletes a request from local storage.
 * @param {string} id
 * @returns {boolean}
 */
export function deleteRequest(id) {
  const all = getRawRequests();
  const filtered = all.filter(r => r.id !== id);
  if (filtered.length === all.length) return false;
  return saveRawRequests(filtered);
}

/**
 * Returns Tailwind badge classes for a given request status.
 * @param {string} status
 * @returns {string}
 */
export function getStatusBadgeClass(status) {
  switch (status) {
    case 'Submitted':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'In Review':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'Resolved':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'Rejected':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

