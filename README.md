<div align="center">
  <h1>🏍️ BCC Riders Club Management System</h1>
  <p><strong>Comprehensive Club Management & ERP Application</strong></p>
</div>

---

## 📌 Overview

**BCC Riders Club** is a full-featured management and ERP platform designed specifically for motorcycle clubs and rider organizations. The system streamlines member registration, official club records, nationwide Philippine address selection, annual/monthly financial dues tracking, bike profile management, club role assignments, and activity logs.

---

## ✨ Key Features

### 👤 Member Registration & Directory
- **Complete Philippine Address Selector**: Full support for all 17 Philippine regions, provinces, cities/municipalities, and barangays with custom text overrides.
- **Detailed Member Profiles**: Personal information, blood type, civil status, occupation, emergency contacts, affiliations, and leader contact numbers.
- **Vehicle & Licensing Records**: Track bike make, model, engine displacement (cc), chassis/CR/OR numbers, plate numbers, and LTO restriction codes.
- **Membership Approval Workflow**: Role-based tracking for pending, approved, or rejected member applications.
- **Digital ID Card Generator**: Auto-generates printable club membership IDs with QR codes.

### 💰 Finance & Dues Management
- **Membership & Monthly Dues**: Log and monitor membership registration fees and monthly due payments per member.
- **Dynamic Collections & Expenses**: Custom collection campaigns and club expenditure logging.
- **Financial Settings**: Configurable default fee structures and payment instructions.

### 📅 Events & Activity Logging
- **Attendance & Activity Log**: Track attendance for rides, general assemblies, and official club events.
- **Member Activity Records**: Comprehensive history of member participations, payment receipts, and status updates.

### 🛡️ Roles & Permissions
- **Structured Leadership Roles**: Executive positions (President, Vice-President, Secretary, Treasurer, Road Captain, Safety Officer, Members Representative, Social Media, and Member).
- **Admin Dashboard**: Comprehensive management overview for club officers.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, Lucide React Icons
- **Data Persistence**: Local Storage / IndexedDB with Firestore Cloud Sync capability
- **Document Export**: PDF generation, printable ID templates

---

## 🚀 Running Locally

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** or **yarn**

### Quickstart

1. **Clone or open the project folder**
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Configure Environment Variables** (Optional for cloud sync):
   Copy `.env.example` to `.env` or set `GEMINI_API_KEY` if required.
4. **Start the development server**:
   ```bash
   npm run dev
   ```
5. Open your browser and navigate to `http://localhost:3000`.

---

## 📂 Project Structure

```
├── src/
│   ├── components/       # UI modules (Members, Finances, ActivityLog, Registration, etc.)
│   ├── data/             # Philippine address datasets (Regions, Provinces, Cities, Barangays)
│   ├── lib/              # Local DB & storage sync helpers
│   ├── types.ts          # TypeScript interfaces & role definitions
│   ├── App.tsx           # Main application routing and state container
│   └── main.tsx          # Application entry point
├── public/               # Static assets (Logos, icons)
├── package.json          # Dependency manifest and scripts
└── README.md             # Project documentation
```

---

## 📄 License

This project is maintained for **BCC Riders Club**. All rights reserved.
