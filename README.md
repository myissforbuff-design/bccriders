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
- **Real-Time Financial Sync**: Multi-key rider matching across user IDs, usernames, member numbers (e.g. `BRC-0002`), and full names with cross-tab and server synchronization.
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
- **Database & Sync**: MongoDB Atlas with local cache fallback (`localStorage` & storage listeners)
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
│   ├── hooks/            # Custom React hooks (useModalDismiss, etc.)
│   ├── lib/              # Data persistence, MongoDB sync endpoints & mock data (db.ts, mockData.ts)
│   ├── types.ts          # Central TypeScript interfaces, enums, and models
│   ├── App.tsx           # App layout, header stacking, and view routing
│   ├── index.css         # Global Tailwind CSS entry point
│   └── main.tsx          # Application root
├── server.ts             # Express server handling MongoDB APIs & static serving
├── package.json          # Dependency manifest and scripts
└── README.md             # Project documentation
```

---

## 📄 License & Ownership

This project is maintained for **BCC Riders Club**. All rights reserved.

