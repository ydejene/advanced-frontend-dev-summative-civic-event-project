/**
 * Centralized jQuery AJAX client.
 *
 * Automatically attaches a Bearer token to protected requests when a session
 * token is present. Callers receive a jQuery Deferred/Promise.
 */
import Config from './config.js';
import { getToken } from './utils.js';

/**
 * Core request function.
 * @param {Object} options
 * @param {string}  options.method       - HTTP method (GET, POST, PUT, PATCH, DELETE).
 * @param {string}  options.endpoint     - Path relative to API_URL (e.g. '/events').
 * @param {*}       [options.data]       - Request payload (plain object or FormData).
 * @param {boolean} [options.auth=true]  - Whether to attach the Bearer token.
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

  return $.ajax(ajaxConfig);
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

  /** Public requests that do not attach a token. */
  public: {
    post: (endpoint, data) => request({ method: 'POST', endpoint, data, auth: false }),
  },
};

export default api;

