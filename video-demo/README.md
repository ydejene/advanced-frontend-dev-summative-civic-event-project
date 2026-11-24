# CivicEvents — Walkthrough & Demonstration Video

This folder is the designated repository location for the CivicEvents project walkthrough and demonstration video.

---

## Video Information

| Item | Details |
|---|---|
| **Project Name** | CivicEvents — Accessible City Events & Services Portal |
| **Course** | ALU BSE — Advanced Frontend Development Summative Project |
| **Duration** | 5–7 minutes (comprehensive feature walkthrough) |
| **Demonstration Link** | *Final demonstration video link will be added here upon upload.* |

---

## Walkthrough Structure

The demonstration video covers the three required evaluation areas:

### 1. Normal User (Community Resident) Journey
- **Authentication & Onboarding:** Account signup with password strength validation, user login, and automated session persistence.
- **Event Discovery & Details:** Keyword searching, category filtering, and date-range selection on the public events directory; viewing speaker schedules, venue details, and interactive registration.
- **Event Participation:** One-click event registration, attendance status tracking in "My Registrations", registration cancellation, and attendee star-rating/feedback submission.
- **Media Feeds:** Browsing audio announcements with client-side duration calculation and audio playback; watching promotional video campaigns with captions and text transcripts.
- **Civic Engagement:** Submitting neighborhood service requests and inspecting lifecycle updates; checking notifications via the navigation bell dropdown and full inbox.

### 2. Administrator (Municipal Operations) Journey
- **Administrative Access & Dashboard:** Role-based access enforcement (`requireAdmin`), navigating the administrative operations dashboard with verified KPI metrics and growth trends.
- **Event Lifecycle Management:** Creating new events with image upload, updating existing event details, publishing status toggling, and deletion controls.
- **Media Content Management:** Publishing voice announcements with audio file upload; publishing video campaigns with video file upload and transcript management.
- **Community Governance:** Broadcasting system alerts to residents, reviewing attendee feedback across events, managing the resident user directory, and updating service request lifecycle statuses.

### 3. Architecture & Technical Integration
- **Frontend / Backend Communication:** Live demonstration of jQuery AJAX client sending authenticated requests with Bearer tokens to the Node.js/Express API (`http://localhost:4000/api`).
- **Database Persistence:** Verification of PostgreSQL database updates following user actions (registrations, feedback, user records).
- **Responsive Layout & Accessibility:** Screen resizing demonstrating responsive Tailwind CSS layouts, keyboard navigation (Tab/Shift+Tab focus trapping, Escape key dialog dismissal), and semantic HTML5 structure.

---

[Return to Project Root README](../README.md)
