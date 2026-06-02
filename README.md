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
│       └── index.css
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
export REKA_API_KEY=your_reka_api_key
python main.py
```

API at http://localhost:8000 (health check: http://localhost:8000/api/health).

On Windows PowerShell, set the key with:

```powershell
$env:REKA_API_KEY="your_reka_api_key"
python main.py
```

Optional backend environment variables:

- `REKA_MODEL`: defaults to `reka-flash`
- `REKA_BASE_URL`: defaults to `https://api.reka.ai/v1`
- `CORS_ORIGINS`: comma-separated frontend origins, defaults to `http://localhost:5173`

## Backend API

AuraHear exposes alert-ready safety analysis endpoints:

- `POST /api/analyze/frame`: multipart form with `frame` image file and optional `context`
- `POST /api/analyze/video`: multipart form with `video` short video file and optional `context`
- `POST /api/analyze/frame-url`: JSON body with `media_url` and optional `context`
- `POST /api/analyze/video-url`: JSON body with `media_url` and optional `context`

Responses include `danger_level`, `confidence`, `spoken_alert`, `recommended_action`,
`hazards`, `safe_path`, and `detected_objects` for frontend text-to-speech warnings.
