# AuraHear

Full-stack monorepo: React frontend and FastAPI backend.

## Project layout

```
AuraHear/
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── public/favicon.svg
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── routes.jsx
│       ├── index.css
│       ├── context/AppProvider.jsx
│       ├── pages/
│       │   ├── WalkingPage.jsx
│       │   └── NavigationPage.jsx
│       ├── components/
│       │   ├── SettingsDrawer.jsx
│       │   ├── FeedbackToast.jsx
│       │   └── ui/sheet.jsx
│       ├── hooks/
│       └── api/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       └── api/routes.py
└── README.md
```

## Development

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at http://localhost:5173. API requests to `/api` are proxied to the backend.

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

API at http://localhost:8000 (health check: http://localhost:8000/api/health).
