# CivicEvents — Accessible City Events & Services Portal

CivicEvents is an accessible, responsive municipal web portal designed to connect community residents with municipal activities, civic workshops, official city announcements, promotional campaigns, and local service inquiries.

Developed as a summative project for **Advanced Frontend Development (ALU BSE)**, the portal pairs a modern, standards-compliant static frontend with a supplied Node.js/Express REST API and PostgreSQL database.

---

## 1. Implemented Features

CivicEvents provides a complete public and role-gated community platform:

- **Public Event Discovery & Inspection:**
  - Dynamic events catalog supporting keyword search, category filtering, and date-range selection (`upcoming`, `today`, `this_week`, `past`).
  - Comprehensive event detail views with venue maps/location, speaker rosters, schedules, and category-themed fallback imagery.
  - Header search shortcut providing quick navigation and auto-focus from any page into the event search interface.

- **Authentication & User Sessions:**
  - Resident registration with client-side password strength validation (length, uppercase, lowercase, numbers, special characters).
  - Secure login with JWT token caching in `localStorage` and automatic cross-tab session synchronization.
  - User profile management allowing residents to update personal contact details (full name and email).

- **Event Participation & Feedback:**
  - One-click event registration with instant pass confirmation.
  - Dedicated "My Registrations" portal displaying confirmed attendance and registration cancellation.
  - Post-event attendee feedback system supporting 1–5 star ratings and written reviews.

- **Municipal Media Feeds:**
  - Audio announcements feed featuring an HTML5 audio player, real-time client-side duration calculation, and audio file uploads for administrators.
  - Promotional video campaigns feed with an embedded video player, closed captions support, accessible text transcripts, and video uploads for administrators.

- **Notifications Center:**
  - Persistent navigation bell with real-time unread badge tracking.
  - Interactive dropdown preview with quick "Mark all as read" action.
  - Dedicated notifications inbox page with filter controls and individual delete actions.

- **Administrative Operations:**
  - Centralized operations dashboard presenting verified system metrics and platform KPI growth trends.
  - Full Event CRUD console (`/pages/admin/events.html`) supporting event creation with multipart image upload, editing, schedule updates, publishing status toggles, and deletion.
  - User account management table with role filtering, account status toggling (`enable`/`disable`), and pagination.
  - Event feedback moderation console displaying attendee reviews and satisfaction statistics across all events.
  - System notification broadcasting console to dispatch announcements to community residents.

- **Service Request Demonstrator:**
  - Resident neighborhood issue submission form (e.g. road repair, waste management, streetlight outage) with client-side input validation.
  - Resident tracking interface to inspect submitted tickets and review status updates.
  - Administrative review console allowing city staff to inspect reports, append status notes, and update ticket lifecycle stages (`Pending`, `In Progress`, `Resolved`, `Rejected`).

---

## 2. Technology Stack

### Frontend Application
- **HTML5:** Semantic document structure, landmark elements (`header`, `nav`, `main`, `section`, `footer`), ARIA attributes (`role="dialog"`, `aria-modal="true"`, `aria-live`), and keyboard accessibility.
- **Tailwind CSS 3 (CLI):** Custom municipal design system (Urban Teal palette: Deep Teal `#163B3A`, Teal `#247A70`, Soft Mint `#D9EAE4`, Off-white `#F5F7F5`, Warm Amber `#E6A756`), responsive grid layouts, and minified utility output.
- **jQuery 3.7:** DOM manipulation, asynchronous AJAX communication, dynamic template rendering, and Bearer token injection.

### Supplied Backend API
- **Runtime:** Node.js (v18+) & Express 5.
- **Database:** PostgreSQL (v15+) for relational data storage.
- **Authentication:** JSON Web Tokens (JWT) & bcrypt password hashing.
- **File Uploads:** Multer middleware for handling multipart image, audio, and video uploads.

---

## 3. Repository Structure

```
├── README.md                      # Primary repository documentation (this file)
├── backend/                       # Supplied Node.js/Express API & PostgreSQL database
│   ├── README.md                  # Backend setup and endpoint documentation
│   ├── server.js                  # Application server entry point (port 4000)
│   ├── app.js                     # Express app setup and route mounting
│   ├── migrations/                # Database SQL migration scripts
│   ├── src/                       # Controllers, models, routes, middlewares, config
│   └── uploads/                   # Multipart storage for media uploads
├── frontend/                      # Client-side static web application
│   ├── README.md                  # Detailed frontend technical guide
│   ├── package.json               # Tailwind CLI build scripts & dependencies
│   ├── tailwind.config.js         # Design tokens, color palette, and content paths
│   ├── index.html                 # Municipal portal landing page
│   ├── css/                       # Source input stylesheet and compiled output.css
│   ├── js/                        # API client, auth helpers, route guards, utils
│   │   ├── config.js              # Centralized API base URL configuration
│   │   ├── guards.js              # Client-side route and role guards
│   │   └── pages/                 # Page-specific JavaScript controllers
│   ├── pages/                     # Application HTML templates
│   └── assets/                    # SVG icons, curated images, and video assets
└── video-demo/                    # Video walkthrough documentation
    └── README.md                  # Video details, outline, and demonstration link
```

---

## 4. Prerequisites & Local Setup

### Prerequisites
- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher
- **PostgreSQL:** v15.0 or higher
- **Web Browser:** Modern Chromium, Firefox, or Safari browser

---

### Step 1: Backend Database & Server Setup

1. **Create the PostgreSQL Database:**
   Using `psql` or pgAdmin, create the project database:
   ```sql
   CREATE DATABASE "civic-events-db";
   ```

2. **Configure Environment Variables:**
   Navigate into the `backend/` directory:
   ```bash
   cd backend
   ```
   Create or edit the `.env` file with your local database credentials:
   ```env
   PORT=4000
   DB_USER=postgres
   DB_PASS=your_postgres_password
   DB_NAME=civic-events-db
   DB_HOST=localhost
   DB_PORT=5432
   JWT_SECRET=your_jwt_secret_key
   ```

3. **Install Dependencies & Run Migrations:**
   ```bash
   npm install
   ```
   Execute the migration SQL file to create the database tables:
   ```bash
   psql -U postgres -d civic-events-db -h localhost -p 5432 -f ./migrations/001_create_tables.sql
   ```

4. **Start the Backend Server:**
   ```bash
   npm run dev
   ```
   The backend will run at `http://localhost:4000`. Verify its health by visiting:
   ```
   http://localhost:4000/health
   ```
   *(Expected response: `{"ok":true,"env":"development"}`)*

---

### Step 2: Frontend Setup & Execution

1. **Install Frontend Dependencies:**
   From the repository root, navigate into `frontend/`:
   ```bash
   cd frontend
   npm install
   ```

2. **Compile Tailwind CSS:**
   Compile the stylesheet using the local Tailwind CLI:
   ```bash
   npm run build
   ```
   *(Optional: run `npm run watch` during active frontend development)*

3. **Launch the Static Web Server:**
   Because the frontend uses absolute asset paths, run a local HTTP server:

   *Using Node.js `http-server` (recommended):*
   ```bash
   npx http-server -p 3000 -c-1
   ```

   *Using Python:*
   ```bash
   python -m http.server 3000
   ```

4. **Access the Portal:**
   Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## 5. Frontend / Backend Connection

- **Configuration File:** Frontend API connectivity is centralized in [`frontend/js/config.js`](frontend/js/config.js):
  ```javascript
  const Config = {
    BASE_URL: 'http://localhost:4000',
    API_URL:  'http://localhost:4000/api',
  };
  export default Config;
  ```
- **Default Local API URL:** `http://localhost:4000/api`
- **Request Authentication:** All protected requests automatically inject the stored JWT token via the HTTP `Authorization` header (`Bearer <token>`) using the shared API wrapper in [`frontend/js/api.js`](frontend/js/api.js).
- **Environment Separation:** The frontend is a static web application and requires no server-side environment variables or secrets. Sensitive configuration (database credentials, JWT signing secret) is strictly isolated to the backend `.env` file.

---

## 6. Authentication & Role-Based Access

CivicEvents implements defense-in-depth role-based access control:

### User Experiences
- **Community Resident (`role: 'user'`):**
  - Public browsing of events, announcements, and promotions.
  - Event registration, attendance management, and feedback submission.
  - Service request submission and personal profile editing.
  - Prevented from accessing administrative interfaces or controls.

- **Municipal Administrator (`role: 'admin'`):**
  - Access to the administrative operations dashboard (`/pages/admin/dashboard.html`).
  - Full Event CRUD management (`/pages/admin/events.html`).
  - Multimedia announcement and promotion publishing with file uploads.
  - System notification broadcasting, feedback moderation, and user status controls.
  - Review and triage of resident service requests.

### Access Guards & Architecture
- **Client-Side Route Guards ([`frontend/js/guards.js`](frontend/js/guards.js)):**
  - `requireAuth()`: Enforces an active session on resident-only pages; unauthenticated visitors are redirected to login with their intended return path preserved.
  - `requireAdmin()`: Enforces `role === 'admin'` on all administrative consoles (`/pages/admin/*`); non-admin users are immediately redirected to `/index.html?error=forbidden`.
  - `requireGuest()`: Directs already-authenticated visitors away from login and signup forms.
- **Security Authority Disclosure:**
  - Client-side guards manage interface visibility and user workflow.
  - True security is enforced by the backend Express middleware (`authenticate` and `authorize(['admin'])`), which independently verifies token validity and user role permissions on every protected endpoint.

---

## 7. Implementation Notes & Limitations

The frontend adheres strictly to the contracts and capabilities of the supplied backend:

1. **Service Requests Module:** The supplied backend schema and API do not include endpoints for municipal service requests. This capability is implemented as a client-side demonstrator using browser `localStorage` (`civicevents_service_requests`), maintaining strict separation per browser profile.
2. **Account Disabling:** While the administrator interface allows toggling an account's active-status flag (`is_active` via `PATCH /api/users/:id/enable` and `/disable`), the supplied backend does not enforce that flag when authenticating users (`POST /api/auth/login`) or when processing authenticated requests (`authenticate` middleware). The frontend accordingly presents this control as an administrative status indicator and audit record rather than an active session termination mechanism.
3. **Event Registration Idempotency:** The backend marks cancelled registrations as `cancelled` rather than deleting the row. Subsequent re-registration attempts return HTTP 409 Conflict per database uniqueness constraints. The UI gracefully explains this constraint to attendees.
4. **Foreign Key Deletion Constraint:** Attempting to delete an event that has active attendee registrations returns HTTP 500 from the backend due to PostgreSQL foreign-key constraints (`registrations_event_id_fkey`). The admin interface captures this error and provides clear guidance.
5. **Notification Read Status:** The backend does not supply a mark-as-read endpoint. Read tracking is maintained in client-side storage scoped per user (`ce_read_notifications_<userId>`).
6. **Media Feed Access:** Backend endpoints `GET /api/announcements` and `GET /api/promos` require authentication. Unauthenticated visitors are presented with a clear sign-in prompt to access civic audio and video feeds.

---

## 8. Demonstration Video

A comprehensive 5–7 minute walkthrough video demonstrates all core features, role-based workflows, and database integration.

- **Video Documentation & Outline:** See [`video-demo/README.md`](video-demo/README.md) for full walkthrough details and the demonstration structure.
- **Video Link:** *The walkthrough video link will be added to `video-demo/README.md` upon final upload.*

---

## 9. Further Documentation

- **Frontend Technical Reference:** [`frontend/README.md`](frontend/README.md)
- **Backend API Reference:** [`backend/README.md`](backend/README.md)
- **Video Demonstration Outline:** [`video-demo/README.md`](video-demo/README.md)
