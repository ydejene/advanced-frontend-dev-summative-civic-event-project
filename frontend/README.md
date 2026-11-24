# CivicEvents — Accessible City Events & Services Portal

## 1. Project Overview

CivicEvents is an accessible, responsive municipal web portal designed to connect community residents with city activities, civic workshops, official announcements, promotional campaigns, and municipal service inquiries.

The frontend is a static multi-page application that interfaces with a Node.js/Express REST API backed by a PostgreSQL database.

---

## 2. Key Features

- **Public & Community Exploration:**
  - Homepage showcasing community event categories, recent highlights, and a platform accessibility commitment.
  - Public events catalog with keyword search, category filtering, and date-range selection.
  - Event details with venue information, schedules, speaker lists, and direct ticket registration.
  - Authenticated community member feeds for audio announcements (with client-side duration calculation) and promotional video campaigns (with accessible text transcripts).
- **Resident Account Management:**
  - Secure signup and login with client-side password strength validation.
  - Personal profile management allowing users to update their full name and email address.
  - "My Registrations" portal to view confirmed event passes and cancel attendance.
  - Event feedback system allowing attendees to submit and update star ratings and comments.
  - Notifications center with an accessible navigation bell preview and user-scoped unread tracking.
  - Local service requests submission and status tracking for neighborhood maintenance issues.
- **Administrative Operations:**
  - Operations dashboard presenting verified municipal metrics and KPI growth trends.
  - User account management table with role filtering, status toggling, pagination, and active session protection.
  - Global event feedback moderation console.
  - Media management consoles for publishing audio announcements and video promotional campaigns.
  - Notification management console for broadcasting municipal alerts.
  - Service request management console to review resident tickets and update lifecycle statuses.

---

## 3. Technology Stack

| Technology | Purpose | Implementation Details |
|---|---|---|
| **HTML5** | Semantic structure & accessibility | Multi-page architecture, ARIA attributes, skip links, semantic landmarks |
| **Tailwind CSS 3 (CLI)** | Styling & responsive layout | Compiled via Tailwind CLI, custom Urban Teal palette, fully responsive |
| **jQuery 3.7** | DOM operations & AJAX client | API requests, event listeners, dynamic DOM rendering, Bearer token injection |

*Note: The frontend is built without frontend frameworks (React, Vue, Angular) or external CSS UI libraries (Bootstrap).*

---

## 4. Project Structure

```
frontend/
├── index.html                      # Portal homepage
├── package.json                    # Build scripts and local dev dependencies
├── tailwind.config.js              # Theme colors, fonts, and content paths
├── README.md                       # Project documentation
├── assets/
│   ├── icons/                      # SVG and PNG brand assets
│   ├── images/                     # Curated photography for events and hero sections
│   └── videos/                     # Local demo video storage
├── css/
│   ├── input.css                   # Custom font imports and Tailwind directives
│   └── output.css                  # Compiled, minified stylesheet (generated)
├── js/
│   ├── config.js                   # API endpoint configuration
│   ├── api.js                      # jQuery AJAX wrapper with Bearer token injection
│   ├── auth.js                     # Authentication state, session sync & profile helpers
│   ├── components.js               # Dynamic header, footer, navigation & dropdowns
│   ├── guards.js                   # Route guards (requireAuth, requireAdmin, requireGuest)
│   ├── notifications.js            # Notification fetching & user-scoped read tracking
│   ├── serviceRequests.js          # Client-side localStorage persistence module
│   ├── utils.js                    # Formatting, sanitization, debounce & toast helpers
│   └── pages/                      # Page-specific controller scripts
│       ├── home.js                 # Homepage dynamic counts & previews
│       ├── login.js                # Login controller & validation
│       ├── signup.js               # Registration controller & password regex
│       ├── events.js               # Event listing, search, category & date filters
│       ├── event-detail.js         # Event details, registration modal & feedback
│       ├── registrations.js        # User event registrations & cancellation
│       ├── profile.js              # User profile details & permitted updates
│       ├── announcements.js        # Announcement feed, category filters & audio player
│       ├── announcement-detail.js  # Announcement details & transcript viewer
│       ├── promotions.js           # Promotion video campaigns grid
│       ├── promo-detail.js         # Promotion video player & captions
│       ├── notifications.js        # Notifications inbox & user-scoped read tracking
│       ├── service-requests.js     # User service request creation & tracking
│       └── admin/                  # Administrative management consoles
│           ├── dashboard.js        # Operations dashboard & backend KPI statistics
│           ├── users.js            # User directory, role filters & status management
│           ├── feedback.js         # Global event feedback moderation console
│           ├── announcements.js    # Announcement authoring, upload & status toggle
│           ├── promotions.js       # Video campaign upload & status toggle
│           ├── notifications.js    # Broadcast alerts & notification management
│           └── service-requests.js # Local service request review & lifecycle update
└── pages/
    ├── auth/                       # login.html, signup.html
    ├── events/                     # index.html, detail.html
    ├── announcements/              # index.html, detail.html
    ├── promotions/                 # index.html, detail.html
    ├── notifications/              # index.html
    ├── user/                       # profile.html, registrations.html, service-requests.html
    └── admin/                      # dashboard, users, feedback, announcements,
                                    # promotions, notifications, service-requests
```

---

## 5. Prerequisites

| Requirement | Minimum Version | Note |
|---|---|---|
| **Node.js** | 18 LTS | Required for Tailwind CLI build tools |
| **npm** | 9+ | Package manager for local build dependencies |
| **PostgreSQL** | 15+ | Required by the separate backend database |

---

## 6. Installation & Setup

### 1. Install Dependencies

From the repository root, change directory into `frontend/`:

```bash
cd frontend
npm install
```

This installs Tailwind CSS and jQuery locally into `frontend/node_modules/`.

### 2. Build Tailwind CSS

Compile the production CSS bundle:

```bash
npm run build
```

This compiles `css/input.css` into `css/output.css` with minification.

### 3. Watch CSS During Development

To watch source HTML and JavaScript files for utility class updates:

```bash
npm run watch
```

---

## 7. Backend Configuration & Connectivity

The frontend consumes the REST API at:
```
http://localhost:4000/api
```

Base URL configuration is centralized in `frontend/js/config.js`:
```javascript
const Config = {
  BASE_URL: 'http://localhost:4000',
  API_URL:  'http://localhost:4000/api',
};
export default Config;
```

### Starting the Backend

The backend must be running separately. From the `backend/` directory:

```bash
cd ../backend
npm install
npm run dev
```

The backend connects to PostgreSQL (`civic-events-db`) on port 5432 and listens on port 4000. Verify backend health by visiting:
```
http://localhost:4000/health
```
A healthy response returns: `{"ok":true,"env":"development"}`.

---

## 8. Running the Frontend

The frontend consists of static HTML files requiring an HTTP server so that absolute resource paths (`/css/output.css`, `/js/...`, `/assets/...`) resolve correctly.

From the `frontend/` directory, launch a local web server:

**Using Node.js `http-server`:**

```bash
npx http-server -p 3000 -c-1
```

**Using Python:**

```bash
python -m http.server 3000
```

**Using VS Code Live Server:**
Open VS Code with `frontend/` set as the workspace root, right-click `index.html`, and select **Open with Live Server**.

The portal will be accessible at:
```
http://localhost:3000
```

---

## 9. Authentication & Role Overview

The portal implements role-based access control and session management:

- **Session Management:** JWT tokens and user summaries are cached in `localStorage` under `ce_token` and `ce_user`.
- **Cross-Tab Synchronization:** A storage event listener automatically synchronizes login, logout, and token expiration across open browser tabs.
- **Route Guards:**
  - `requireAuth()`: Guards member-only pages (`/pages/user/*`, `/pages/notifications/*`), redirecting unauthenticated visitors to `/pages/auth/login.html`.
  - `requireAdmin()`: Restricts administrative consoles (`/pages/admin/*`) strictly to accounts with the `admin` role.
  - `requireGuest()`: Redirects authenticated users away from guest-only entry pages (`/pages/auth/login.html`, `/pages/auth/signup.html`).
- **Data Minimization:** No sensitive credentials (passwords, tokens, database hashes) are stored in client-side state or exposed in UI code.

---

## 10. Important Implementation Limitations

The frontend interfaces with the provided backend according to its existing contracts:

1. **Service Requests:** The backend does not provide a database table or endpoints for service requests. This feature is implemented as a client-side demonstrator using browser `localStorage` (`civicevents_service_requests`). Requests are isolated to the current browser profile and are not transmitted to a central server.
2. **Account Disabling:** Setting `is_active = false` updates the database record for auditing; the backend authentication middleware does not revoke active tokens or block subsequent logins. The UI accurately describes this as an administrative status record.
3. **Event Registration Idempotency:** Cancelling an event registration marks it as `cancelled`; attempting to re-register for the same event returns HTTP 409 Conflict because the backend preserves the existing registration record.
4. **Event Deletion Constraint:** Deleting an event that has existing attendee registrations fails with a PostgreSQL foreign-key constraint violation (`registrations_event_id_fkey`).
5. **Notification Read Status:** The backend does not provide a mark-as-read endpoint. Read tracking is maintained client-side in `localStorage` scoped per authenticated user (`ce_read_notifications_<userId>`).
6. **Administrator Notification Scope:** `GET /api/notifications` returns broadcasts and direct notifications addressed to the administrator; it does not return private notifications sent to other users.
7. **Announcement Transcripts & Duration:** Audio duration is computed client-side via HTML5 Audio metadata upon file load. A neutral notice is shown where text transcripts are unavailable.
8. **Promotion Captions:** Captions are stored as plain text descriptions in the database rather than timed WebVTT track cues, and are rendered as text transcripts below the video player.
9. **Media Feeds Access:** The backend endpoints `GET /api/announcements` and `GET /api/promos` require authentication. Unauthenticated visitors are presented with a sign-in prompt before media can be loaded.
