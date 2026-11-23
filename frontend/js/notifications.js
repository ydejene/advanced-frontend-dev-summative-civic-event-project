/**
 * Shared Notifications Service
 *
 * Provides API communication, user-scoped local read/unread state tracking,
 * destination routing for notification metadata, and badge synchronization.
 *
 * NOTE ON SERVER PERSISTENCE:
 * The backend database includes a boolean `read` column, but provides no endpoint
 * (PATCH/PUT) to update notification read status. Therefore, read/unread state
 * is tracked locally in localStorage, strictly scoped by the authenticated user's ID
 * to prevent leaking read state across accounts on the same device.
 */
import api from './api.js';
import { getUser, isAuthenticated } from './auth.js';
import { escapeHtml, timeAgo } from './utils.js';

const STORAGE_PREFIX = 'ce_read_notifs_';

/**
 * Returns the localStorage key for the given user ID.
 * @param {string} [userId]
 * @returns {string}
 */
function getStorageKey(userId) {
  const uid = userId || getUser()?.id || 'guest';
  return `${STORAGE_PREFIX}${uid}`;
}

/**
 * Retrieves the Set of read notification IDs for the specified user.
 * @param {string} [userId]
 * @returns {Set<string>}
 */
export function getReadNotificationIds(userId) {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

/**
 * Checks whether a notification has been read by the user.
 * @param {string} notificationId
 * @param {string} [userId]
 * @returns {boolean}
 */
export function isNotificationRead(notificationId, userId) {
  if (!notificationId) return false;
  const readSet = getReadNotificationIds(userId);
  return readSet.has(String(notificationId));
}

/**
 * Marks a single notification as read.
 * @param {string} notificationId
 * @param {string} [userId]
 */
export function markAsRead(notificationId, userId) {
  if (!notificationId) return;
  const uid = userId || getUser()?.id;
  const readSet = getReadNotificationIds(uid);
  readSet.add(String(notificationId));

  try {
    localStorage.setItem(getStorageKey(uid), JSON.stringify([...readSet]));
  } catch (err) {
    console.warn('Failed to save read notification state', err);
  }

  dispatchNotificationUpdate();
}

/**
 * Marks a single notification as unread.
 * @param {string} notificationId
 * @param {string} [userId]
 */
export function markAsUnread(notificationId, userId) {
  if (!notificationId) return;
  const uid = userId || getUser()?.id;
  const readSet = getReadNotificationIds(uid);
  readSet.delete(String(notificationId));

  try {
    localStorage.setItem(getStorageKey(uid), JSON.stringify([...readSet]));
  } catch (err) {
    console.warn('Failed to update unread notification state', err);
  }

  dispatchNotificationUpdate();
}

/**
 * Marks an array of notifications as read in bulk.
 * @param {Array<string>} notificationIds
 * @param {string} [userId]
 */
export function markAllAsRead(notificationIds, userId) {
  if (!Array.isArray(notificationIds) || notificationIds.length === 0) return;
  const uid = userId || getUser()?.id;
  const readSet = getReadNotificationIds(uid);

  notificationIds.forEach((id) => {
    if (id) readSet.add(String(id));
  });

  try {
    localStorage.setItem(getStorageKey(uid), JSON.stringify([...readSet]));
  } catch (err) {
    console.warn('Failed to bulk-save read notifications', err);
  }

  dispatchNotificationUpdate();
}

/**
 * Triggers a custom event across the window to notify all listening components.
 */
function dispatchNotificationUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('notifications-updated'));
  }
}

/**
 * Fetches notifications addressed to the current user and broadcast notifications.
 * Backend contract: GET /api/notifications returns { status: 200, data: [...] }
 * @returns {jQuery.Deferred}
 */
export function fetchNotifications() {
  return api.get('/notifications');
}

/**
 * Deletes a notification (Admin only).
 * Backend contract: DELETE /api/notifications/:id
 * @param {string} id
 * @returns {jQuery.Deferred}
 */
export function deleteNotification(id) {
  return api.delete(`/notifications/${id}`).done(() => {
    dispatchNotificationUpdate();
  });
}

/**
 * Resolves the destination URL for a notification based on its type and metadata.
 * @param {Object} notification
 * @returns {string|null} Relative path or null if no destination
 */
export function resolveNotificationLink(notification) {
  if (!notification) return null;
  const meta = notification.metadata || {};
  const type = (notification.type || '').toLowerCase();

  // Explicit ID references inside metadata take precedence
  if (meta.announcement_id) {
    return `/pages/announcements/detail.html?id=${encodeURIComponent(meta.announcement_id)}`;
  }
  if (meta.promo_id) {
    return `/pages/promotions/detail.html?id=${encodeURIComponent(meta.promo_id)}`;
  }
  if (meta.event_id) {
    return `/pages/events/detail.html?id=${encodeURIComponent(meta.event_id)}`;
  }

  // Type fallbacks
  if (type === 'announcement') {
    return '/pages/announcements/index.html';
  }
  if (type === 'promo') {
    return '/pages/promotions/index.html';
  }
  if (type === 'event') {
    return '/pages/events/index.html';
  }
  if (type === 'registration') {
    return '/pages/user/registrations.html';
  }

  return null;
}

/**
 * Computes unread count and updates notification badges in the navigation shell.
 */
export function updateNotificationBadge() {
  if (typeof document === 'undefined') return;

  const notifBadge = document.getElementById('notif-badge');
  const mobileNotifBadge = document.getElementById('mobile-notif-badge');

  if (!isAuthenticated()) {
    notifBadge?.classList.add('hidden');
    mobileNotifBadge?.classList.add('hidden');
    return;
  }

  const user = getUser();
  const userId = user?.id;

  fetchNotifications()
    .done((res) => {
      const items = Array.isArray(res?.data) ? res.data : [];
      const readSet = getReadNotificationIds(userId);
      const unreadCount = items.filter((n) => !readSet.has(String(n.id))).length;

      const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);

      if (notifBadge) {
        if (unreadCount > 0) {
          notifBadge.textContent = badgeText;
          notifBadge.classList.remove('hidden');
        } else {
          notifBadge.classList.add('hidden');
        }
      }

      if (mobileNotifBadge) {
        if (unreadCount > 0) {
          mobileNotifBadge.textContent = badgeText;
          mobileNotifBadge.classList.remove('hidden');
        } else {
          mobileNotifBadge.classList.add('hidden');
        }
      }
    })
    .fail(() => {
      // Silently maintain current state on network failure
    });
}

