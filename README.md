<div align="center">
  <h1>🏍️ BCC Riders Club Management System</h1>
  <p><strong>Comprehensive Club Management, Membership ERP & Financial Tracking System</strong></p>
</div>

---

## 📌 Overview

**BCC Riders Club Management System** is a full-featured, mobile-first club management and ERP platform built specifically for motorcycle clubs, riding communities, and chapter networks. 

The application streamlines member onboarding, official membership verifications, digital membership cards with QR codes, motorcycle garage details with breadcrumb overlays, multi-channel financial dues and collections tracking, real-time MongoDB synchronization, and chapter administration.

---

## ✨ Key Features

### 👤 Member Directory & Dynamic Rider Profiles
- **Modern Rider Card & Cover Banner**: Customizable motorcycle cover banners with interactive breadcrumb overlays displaying vehicle details (`MAKE - MODEL > CC > PLATE`).
- **Interactive Avatar & Badge Recognition**: Officer and member badge overlays with calibrated midpoint positioning across banner edges.
- **Smart Responsive Typography**: Adaptive typography that dynamically adjusts font sizes for members with long names.
- **Image Cropping & Photo Uploads**: Built-in interactive modal cropper with aspect ratio presets (1:1 for Avatars, 16:9 for Motorcycle Banners).
- **Digital ID Card & QR Code Generation**: Instant QR code generation linking member profiles with printable digital ID cards.
- **Complete Philippine Address System**: Native support for all 17 Philippine regions, provinces, cities/municipalities, and barangays with text fallback.
- **Detailed Emergency & Garage Info**: Blood type, emergency contacts, driver's license restriction codes, motorcycle engine displacement (cc), CR/OR, and chassis numbers.

### 💰 Financial Dues & Accounting Engine
- **Membership Fee Auto-Enrollment**: Automatic registration and tracking of the ₱200 membership fee upon member approval, synced directly to the rider's profile contribution ledger.
- **Monthly Dues & Custom Collections**: Granular tracking of monthly club dues, ride contributions, charity collections, and emergency funds.
- **Expense Logging & Receipt Management**: Officer expense tracking with category breakdowns and receipt image attachments.
- **Real-Time Financial Sync**: Multi-key rider matching across user IDs, usernames, member numbers (e.g. `BRC-0002`), and full names, with MongoDB change streams pushing every write to all connected devices instantly — no refresh, no tab switch.
- **Financial Settings & Configurable Dues**: Configurable default fee structures, GCash/bank payment instructions, and QR code guides.

### 🛡️ Role-Based Access Control (RBAC) & Approvals
- **Structured Leadership Roles**: Executive positions (President, Vice-President, Secretary, Treasurer, Road Captain, Safety Officer, Members Representative, Social Media Director, and Member).
- **Member Application Workflow**: Multi-stage approval queue for pending, approved, and rejected applications with instant credential generation.
- **Admin Management Dashboard**: Centralized management portal with member status toggles, batch actions, and activity tracking.

### 📱 Mobile-First UI & System Settings
- **Optimized Mobile Scaling**: Ultra-compact, high-density layouts for rider settings, account details, and mobile navigation bars.
- **Strict Stacking Contexts**: Multi-tier `z-index` layering ensuring fixed headers and floating modals remain responsive across all screen sizes.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling & UI**: Tailwind CSS, Lucide React Icons
- **Animations**: Motion (`motion/react`)
- **Backend & API**: Express.js (Node.js) with custom REST API endpoints
- **Database & Sync**: MongoDB Atlas with **real-time change streams pushed over Socket.io** (WebSocket), plus `localStorage`/`sessionStorage` as an offline cache only
- **Utilities**: `qrcode.react`, Canvas-based Image Cropping

---

## 🚀 Running Locally

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** or **yarn**

### Quickstart

1. **Clone or open the project repository**
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Environment Setup** (Optional for MongoDB / Cloud integrations):
   Create a `.env` file from `.env.example`:
   ```env
   MONGODB_URI=your_mongodb_connection_string
   GEMINI_API_KEY=your_gemini_api_key
   ```
4. **Start the development server**:
   ```bash
   npm run dev
   ```
5. Open your browser and navigate to `http://localhost:3000`.

### Production Build

To bundle the application and backend server:
```bash
npm run build
npm start
```

---

## 📂 Project Structure

```
├── src/
│   ├── components/       # UI Views (RiderProfile, Members, Finances, Settings, ActivityLog, etc.)
│   ├── context/          # Global state & Authentication context (AuthContext.tsx)
│   ├── data/             # Philippine PSGC geographic dataset (Regions, Provinces, Cities, Barangays)
│   ├── hooks/            # Custom React hooks (useModalDismiss, useRealtimeSync, etc.)
│   ├── lib/              # Data persistence, MongoDB sync endpoints, real-time client & mock data (db.ts, realtimeSync.ts, mockData.ts)
│   ├── types.ts          # Central TypeScript interfaces, enums, and models
│   ├── App.tsx           # App layout, header stacking, and view routing
│   ├── index.css         # Global Tailwind CSS entry point
│   └── main.tsx          # Application root
├── server.ts             # Express + Socket.io server: MongoDB APIs, change streams & static serving
├── package.json          # Dependency manifest and scripts
└── README.md             # Project documentation
```

---

## 🔄 Real-Time Sync

Data changes propagate to every connected device the instant they hit MongoDB — no page refresh, no
tab switch, no polling.

```
Device A writes ──▶ MongoDB Atlas ──▶ Change Stream ──▶ Socket.io ──▶ Device B, C, D…
   (REST /api/mongodb)                  (server.ts)      (WebSocket)     (React state)
```

- **Server** (`server.ts`): Express and Socket.io share a single `http.Server`, so one port serves
  both the REST API and the `/socket.io` WebSocket endpoint. A change stream watches the members,
  finance, activity, attendance and settings collections and emits `db:change` on every
  insert/update/replace/delete.
- **Client** (`src/lib/realtimeSync.ts`): a singleton Socket.io client refetches the affected
  collection and re-publishes the app's existing `bcc_*_updated` events, so every mounted screen
  updates in place.
- **Resilience**: reconnection is enabled with exponential backoff and jitter (retries forever while
  the tab is open). Every reconnect triggers a full resync, so nothing is missed during a Render
  deploy, a cold start, or a phone switching from Wi-Fi to mobile data. Resume tokens let the server
  pick the oplog back up where it left off.
- **Credential safety**: `members` and `registration` changes are broadcast as *signals only* —
  never document bodies — because those records contain passwords and signature images. Clients
  re-read them over the authenticated REST API.
- **localStorage is cache only**: it survives cold starts and offline use, but it is no longer how
  two devices learn about each other's writes.

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `REALTIME_WATCH_MODE` | `auto` | `auto` prefers one database-level `watch()` cursor and falls back to per-collection `collection.watch()`; `collection` forces per-collection; `database` forces database-level. |
| `REALTIME_REQUIRE_AUTH` | `false` | When `true`, sockets must present a valid session token. Off by default so biometric sign-in sessions (which hold no server token) stay live. |
| `REALTIME_INCLUDE_DOCUMENTS` | `true` | Set `false` to broadcast change signals without document bodies. |
| `REALTIME_ALLOWED_ORIGINS` | *(same-origin)* | Comma-separated origin allow-list, only needed for split-origin deployments. |

`GET /api/realtime/status` reports the active mode, connected client count, watched collections and
last error. `GET /api/health` also includes a compact `realtime` block, so the existing keep-alive
ping doubles as a sync health check.

---

## 📄 License & Ownership

This project is maintained for **BCC Riders Club**. All rights reserved.

