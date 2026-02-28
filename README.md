# Bengaluru Trekkers - Operations Management System

A full-stack web application for managing trek operations, batches, leads, tasks, and more.

---

## Tech Stack

| Layer      | Technology                              |
|------------|----------------------------------------|
| Frontend   | React 19, TailwindCSS, Shadcn/UI      |
| Backend    | Python FastAPI                         |
| Database   | Firebase Firestore                     |
| Auth       | Firebase Authentication                |
| Storage    | Local filesystem (uploads/)            |
| Rich Text  | TipTap Editor                          |

---

## Prerequisites

- **Node.js** v20+ and **Yarn** (for frontend)
- **Python** 3.11+ (for backend)
- **Firebase Project** with Firestore + Authentication enabled
- Firebase Admin SDK JSON credentials file

---

## Project Structure

```
/app
├── backend/
│   ├── server.py              # FastAPI app (all routes)
│   ├── .env                   # Backend environment variables
│   ├── firebase-admin.json    # Firebase Admin SDK credentials
│   ├── requirements.txt       # Python dependencies
│   └── tests/                 # Pytest test files
├── frontend/
│   ├── src/
│   │   ├── App.js             # Main router & layout
│   │   ├── App.css            # Global styles
│   │   ├── pages/             # All page components
│   │   │   ├── Dashboard.js
│   │   │   ├── BatchPlanning.js
│   │   │   ├── BatchDetail.js
│   │   │   ├── TicketBoard.js
│   │   │   ├── WorkloadDashboard.js
│   │   │   ├── TrekMaster.js
│   │   │   ├── LeadManagement.js
│   │   │   ├── UserManagement.js
│   │   │   ├── Checklists.js
│   │   │   ├── Settings.js
│   │   │   └── Login.js
│   │   ├── components/
│   │   │   ├── Sidebar.js
│   │   │   ├── TicketDetailsDialog.js
│   │   │   └── ui/            # Shadcn UI components
│   │   ├── contexts/
│   │   │   └── AuthContext.js
│   │   └── utils/
│   │       └── api.js         # Axios instance
│   ├── public/
│   │   └── index.html
│   ├── .env                   # Frontend environment variables
│   ├── package.json
│   └── tailwind.config.js
└── README.md
```

---

## Environment Setup

### Backend `.env`

Create `/backend/.env`:

```env
FIREBASE_CREDENTIALS_PATH=./firebase-admin.json
CORS_ORIGINS=*
ADMIN_EMAIL=admin@bengalurutrekkers.com
```

> Place your Firebase Admin SDK JSON file at `/backend/firebase-admin.json`

### Frontend `.env`

Create `/frontend/.env`:

```env
REACT_APP_BACKEND_URL=http://localhost:8001
REACT_APP_FIREBASE_API_KEY=your-firebase-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
```

---

## Quick Start Commands

### 1. Backend Setup & Start

```bash
# Navigate to backend
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate        # Mac/Linux
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Start backend server (runs on port 8001)
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Backend will be available at: http://localhost:8001
# API docs at: http://localhost:8001/docs
```

### 2. Frontend Setup & Start

```bash
# Navigate to frontend (in a new terminal)
cd frontend

# Install dependencies
yarn install

# Start development server (runs on port 3000)
yarn start

# Frontend will be available at: http://localhost:3000
```

---

## Cheat Sheet - Common Commands

### Server Management

| Action                        | Command                                                |
|-------------------------------|--------------------------------------------------------|
| Start backend                 | `cd backend && uvicorn server:app --host 0.0.0.0 --port 8001 --reload` |
| Start frontend                | `cd frontend && yarn start`                            |
| Stop any server               | `Ctrl + C` in the terminal                             |
| Start both (2 terminals)      | Terminal 1: backend, Terminal 2: frontend               |

### Dependency Management

| Action                        | Command                                                |
|-------------------------------|--------------------------------------------------------|
| Install Python package        | `pip install package-name`                             |
| Freeze Python deps            | `pip freeze > requirements.txt`                        |
| Install Node package          | `cd frontend && yarn add package-name`                 |
| Install all Node deps         | `cd frontend && yarn install`                          |
| Install all Python deps       | `cd backend && pip install -r requirements.txt`        |

### Testing

| Action                        | Command                                                |
|-------------------------------|--------------------------------------------------------|
| Run all backend tests         | `cd backend && pytest tests/ -v`                       |
| Run specific test file        | `cd backend && pytest tests/test_file.py -v`           |
| Test backend health           | `curl http://localhost:8001/api/health`                 |
| Check frontend compiles       | `cd frontend && yarn build`                            |

### Debugging

| Action                        | Command                                                |
|-------------------------------|--------------------------------------------------------|
| Check backend logs            | Check terminal running uvicorn                         |
| Check frontend logs           | Check terminal running yarn start + browser console    |
| Test API endpoint             | `curl http://localhost:8001/api/health`                 |
| View API docs (Swagger)       | Open `http://localhost:8001/docs` in browser           |

---

## Key API Endpoints

| Method | Endpoint                                    | Description                      |
|--------|---------------------------------------------|----------------------------------|
| GET    | `/api/health`                               | Health check                     |
| GET    | `/api/dashboard/stats`                      | Dashboard statistics             |
| GET    | `/api/treks`                                | List all treks                   |
| POST   | `/api/treks`                                | Create trek                      |
| GET    | `/api/batches`                              | List all batches                 |
| POST   | `/api/batches`                              | Create batch                     |
| GET    | `/api/batches/my`                           | My assigned batches (leads)      |
| GET    | `/api/batches/{id}/participants`            | List batch participants          |
| POST   | `/api/batches/{id}/participants/import`     | Import participants (Excel)      |
| GET    | `/api/batches/{id}/expenses`                | List all expenses for batch      |
| POST   | `/api/batches/{id}/expenses`                | Save my expense sheet            |
| GET    | `/api/batches/{id}/documents`               | List batch documents             |
| POST   | `/api/batches/{id}/documents`               | Upload batch document            |
| GET    | `/api/batches/{id}/feedback`                | List batch feedback              |
| POST   | `/api/batches/{id}/feedback`                | Save feedback                    |
| GET    | `/api/tickets`                              | List all tasks/tickets           |
| POST   | `/api/tickets`                              | Create task                      |
| GET    | `/api/notifications`                        | List notifications               |
| GET    | `/api/users/basic`                          | List all users                   |

---

## Default Login

| Field    | Value                            |
|----------|----------------------------------|
| Email    | admin@bengalurutrekkers.com      |
| Password | admin123456                      |

---

## User Roles

| Role               | Access                                              |
|--------------------|-----------------------------------------------------|
| Super Admin        | Full access to everything                           |
| Operations Manager | Admin-level access to batch features                |
| Trek Lead          | View assigned batches, manage participants, expenses |
| Coordinator        | View assigned batches, limited access               |

---

## Features Implemented

1. **Dashboard** - Stats, upcoming batches, my tasks, my assigned batches
2. **Trek Master** - CRUD for trek definitions
3. **Batch Planning** - Create/manage batches with lead assignments (Super Lead + multiple leads)
4. **Batch Detail** - 4 tabs:
   - **Participants** - Import via Excel, mark boarded/no-show, track payments
   - **Expenses** - Per-lead expense sheets with dynamic additional expenses
   - **Documents** - Upload/download/delete batch documents (permits, tickets)
   - **Feedback** - Positive/negative feedback per lead, admin consolidated view
5. **Task Board** - Kanban board with drag-and-drop, filters, rich text, attachments
6. **Workload Dashboard** - Team workload visualization
7. **Lead Management** - CRUD for trek leads
8. **User Management** - Approve/reject new users, role management
9. **Checklists** - Pre/during/post trek operational checklists
10. **Settings** - Configurable dropdown options
11. **Notifications** - In-app notification system
12. **Mobile Responsive** - Fully functional on mobile web browsers

---

## Troubleshooting

| Issue                          | Solution                                             |
|--------------------------------|------------------------------------------------------|
| Backend won't start            | Check `.env` file exists, Firebase JSON is valid      |
| Frontend blank page            | Check `REACT_APP_BACKEND_URL` in `.env`              |
| Login fails                    | Verify Firebase Auth is enabled in Firebase Console   |
| API returns 401                | Token expired - re-login                              |
| File upload fails              | Check uploads/ directory exists and is writable       |
| CORS errors                    | Set `CORS_ORIGINS=*` in backend `.env`               |
| Port already in use            | Kill process: `lsof -i :8001` then `kill -9 PID`    |
