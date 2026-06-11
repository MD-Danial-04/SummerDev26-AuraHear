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

### Deployment (Vercel)

The repo uses `vercel.json` with separate frontend and backend services:

- **Frontend** — `routePrefix: /` (Vite SPA)
- **Backend** — `routePrefix: /_/backend` (FastAPI internal mount)
- **Public API** — rewrites map `/api/*` → `/_/backend/api/*` so frontend fetch paths stay `/api/health`, `/api/session/start`, etc.

Do not set backend `routePrefix` to `/api` alone — Vercel strips that prefix before forwarding, while FastAPI routes are registered at `/api/*`, which causes 404. Without rewrites, `/api/*` hits the SPA (405 on POST).

For live Reka frame analysis in production:

1. In Vercel → Project → Settings → Environment Variables, add **`REKA_API_KEY`** to the **backend** service (Production and Preview).
2. Optional: `REKA_MODEL` (default `reka-flash`), `CORS_ORIGINS` if calling the API cross-origin.
3. Redeploy after saving env vars — existing deployments do not pick up new variables automatically.

Verify after deploy:

```bash
curl -s https://YOUR-APP.vercel.app/api/health
curl -s -X POST https://YOUR-APP.vercel.app/api/session/start \
  -H "Content-Type: application/json" \
  -d '{"alert_cooldown_seconds":6}'
```

Both should return JSON, not HTML or `{"detail":"Not Found"}`.

Walking mode captures camera frames every ~1.8s and calls `POST /api/session/{id}/analyze/frame`. Without `REKA_API_KEY`, the backend returns a spoken fallback: *"Analysis unavailable. Stop and rescan."*
