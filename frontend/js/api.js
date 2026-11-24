/**
 * Centralized jQuery AJAX client.
 *
 * Automatically attaches Bearer authorization headers to protected requests.
 * Listens for 401 responses on protected requests to clear invalid or expired sessions.
 */
import Config from './config.js';
import { getToken, clearSession } from './auth.js';

/**
 * Core request function.
 * @param {Object} options
 * @param {string}  options.method       - HTTP method (GET, POST, PUT, PATCH, DELETE).
 * @param {string}  options.endpoint     - Path relative to API_URL (e.g. '/events').
 * @param {*}       [options.data]       - Request payload (plain object or FormData).
 * @param {boolean} [options.auth=true]  - Whether to attach Bearer token.
 * @returns {jQuery.Deferred}
 */
function request({ method, endpoint, data = null, auth = true }) {
  const url = Config.API_URL + endpoint;
  const headers = {};
  const token = getToken();

  if (auth && token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const isFormData = data instanceof FormData;
  const ajaxConfig = {
    url,
    method,
    headers,
  };

  if (data !== null) {
    if (isFormData) {
      ajaxConfig.data        = data;
      ajaxConfig.processData = false;
      ajaxConfig.contentType = false;
    } else {
      ajaxConfig.data        = JSON.stringify(data);
      ajaxConfig.contentType = 'application/json';
    }
  }

  const deferred = $.ajax(ajaxConfig);

  /*
   * Session expiry handling:
   * When a protected request receives a 401 Unauthorized response from the API,
   * it indicates that the stored token has expired or is invalid.
   * Clear the invalid session and dispatch a session-expired event.
   */
  deferred.fail((xhr) => {
    if (auth && xhr.status === 401) {
      clearSession();
      window.dispatchEvent(new CustomEvent('session-expired'));
    }
  });

  return deferred;
}

/** Convenience wrappers matching HTTP verbs. */
const api = {
  get:    (endpoint)         => request({ method: 'GET',    endpoint }),
  post:   (endpoint, data)   => request({ method: 'POST',   endpoint, data }),
  put:    (endpoint, data)   => request({ method: 'PUT',    endpoint, data }),
  patch:  (endpoint, data)   => request({ method: 'PATCH',  endpoint, data }),
  delete: (endpoint)         => request({ method: 'DELETE', endpoint }),

  /** POST with FormData (file uploads). */
  upload: (endpoint, formData) => request({ method: 'POST', endpoint, data: formData }),

  /** PUT with FormData (file uploads / updates). */
  uploadPut: (endpoint, formData) => request({ method: 'PUT', endpoint, data: formData }),

  /** Public requests that do not attach a token. */
  public: {
    get:  (endpoint)       => request({ method: 'GET',  endpoint, auth: false }),
    post: (endpoint, data) => request({ method: 'POST', endpoint, data, auth: false }),
  },
};

export default api;
