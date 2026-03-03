# TaskTracker

A real-time task-tracking tool for small teams. Create projects, assign tasks on a Kanban board, and see changes instantly via SSE (Server-Sent Events).

## Quick Start

### Backend (Python/FastAPI)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Backend runs on http://localhost:8000

### Frontend (React/Vite)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173

## Features

- **Auth** — Register/login with email & password, JWT-protected routes
- **Projects** — Create, edit, delete projects; invite members by email
- **Kanban Board** — Tasks with To Do / In Progress / Done columns, priority levels
- **Real-time** — SSE pushes task/project changes to all connected users instantly
- **External API Widget** — Dashboard shows cached data from JSONPlaceholder
- **Dark/Light Mode** — Toggle via navbar button, persisted in localStorage
- **Toast Notifications** — Global success/error/info messages
- **Profile** — Edit display name and avatar URL
