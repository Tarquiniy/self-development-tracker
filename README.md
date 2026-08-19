# Positive Theta PWA

A full-stack **self-development tracker** Progressive Web App (PWA) that helps users track habits, journal, analyse personal progress, and manage custom data tables — all in one place.

**Live:** [positive-theta.vercel.app](https://positive-theta.vercel.app) · **API:** [positive-theta-5n2d.onrender.com](https://positive-theta-5n2d.onrender.com)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Custom Tracker Tables** — create, configure, and fill personal data tables with flexible column types
- **Dashboard & Analytics** — petal charts, radar charts, and time-series visualisations of your progress
- **Journal** — rich-text journal entries with Tiptap editor
- **Blog** — admin-managed blog with categories, tags, comments, and rich-text editing
- **Authentication** — email/password, Yandex OAuth, and Telegram login widget; JWT-based sessions
- **PWA** — installable on mobile & desktop, works offline via service worker
- **Dark / Light theme** — system-aware with manual toggle
- **Admin Panel** — Jazzmin-themed Django admin with Summernote rich text editing

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| **Backend** | Django 5.2, Django REST Framework 3.18 |
| **Database** | PostgreSQL via [Supabase](https://supabase.com) |
| **Auth** | Supabase Auth + JWT (simplejwt) + Social Auth (Yandex, Telegram) |
| **File Storage** | Supabase S3-compatible storage (boto3 / django-storages) |
| **Cache** | Redis (django-redis 7) |
| **Admin UI** | Jazzmin + Grappelli + Summernote |
| **Rich Text** | Tiptap (frontend), CKEditor / Summernote (admin) |
| **Charts** | Chart.js, Recharts, custom SVG charts |
| **Animations** | Framer Motion, React Spring |
| **PWA** | next-pwa (Workbox service worker) |
| **Deployment** | Render.com (backend) + Vercel (frontend) + Nginx |

---

## Project Structure

```
positive-theta/
├── backend/                 # Django application
│   ├── core/                # Settings, URLs, WSGI, authentication
│   ├── users/               # Custom user model, registration, social auth
│   ├── blog/                # Posts, categories, tags, comments, storage
│   ├── tables/              # User tracker tables and entries
│   ├── analytics/           # Analytics and stats
│   ├── payments/            # Subscriptions and payments
│   ├── media/               # Media proxy for Supabase
│   ├── requirements.txt     # Python dependencies
│   └── .env.example         # Backend environment template
│
├── frontend/                # Next.js application
│   ├── app/                 # App Router pages and layouts
│   ├── components/          # Reusable UI components
│   ├── lib/                 # Utilities, API clients, hooks
│   ├── public/              # Static assets, PWA manifest, icons
│   ├── package.json         # Node dependencies
│   └── .env.example         # Frontend environment template
│
├── supabase/
│   └── migrations/          # SQL migrations for Supabase schema
│
├── nginx.conf               # Nginx reverse-proxy configuration
├── render.yaml              # Render.com deployment services
├── Procfile                 # Gunicorn process declaration
├── runtime.txt              # Python version for Render
├── requirements.txt         # Root-level Python dependencies (mirrors backend)
└── Dockerfile               # Docker image for the backend
```

---

## Getting Started

### Prerequisites

- **Python** ≥ 3.11
- **Node.js** ≥ 18
- **PostgreSQL** (or a [Supabase](https://supabase.com) project)
- **Redis** ≥ 7 (for caching; or use a hosted instance)

---

### Backend Setup

```bash
# 1. Clone the repository
git clone https://github.com/Tarquiniy/self-development-tracker.git
cd self-development-tracker

# 2. Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with your Supabase credentials, Redis URL, etc.

# 5. Apply migrations
python manage.py migrate

# 6. Create a superuser (for /admin)
python manage.py createsuperuser

# 7. Collect static files
python manage.py collectstatic --noinput

# 8. Run the development server
python manage.py runserver
```

The API will be available at `http://localhost:8000`.

---

### Frontend Setup

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase URL/anon key and backend API URL

# 3. Start the development server
npm run dev
```

The frontend will be available at `http://localhost:3000`.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Required |
|---|---|---|
| `SECRET_KEY` | Django secret key | ✅ |
| `DEBUG` | `True` / `False` | ✅ |
| `ALLOWED_HOSTS` | Comma-separated hostnames | ✅ |
| `DATABASE_URL` | Full PostgreSQL connection string (overrides individual params) | ✅ |
| `SUPABASE_DB_HOST` | Supabase DB host | ✅ |
| `SUPABASE_DB_PASSWORD` | Supabase DB password | ✅ |
| `SUPABASE_URL` | Supabase project URL | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | ✅ |
| `SUPABASE_S3_KEY` | S3-compatible access key | ✅ |
| `SUPABASE_S3_SECRET` | S3-compatible secret key | ✅ |
| `REDIS_URL` | Redis connection URL | ✅ |
| `EMAIL_HOST` / `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | SMTP credentials | Production |
| `DJANGO_JWT_SECRET` | JWT signing secret | Recommended |

See `backend/.env.example` for a full list.

### Frontend (`frontend/.env.local`)

| Variable | Description | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | ✅ |
| `NEXT_PUBLIC_API_URL` | Django backend URL | ✅ |

See `frontend/.env.example` for a full list.

---

## API Reference

Base URL: `https://positive-theta-5n2d.onrender.com/api/`

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register/` | Register a new user |
| `POST` | `/api/auth/login/` | Log in; returns JWT tokens |
| `POST` | `/api/auth/token/refresh/` | Refresh access token |
| `GET` | `/api/auth/profile/` | Get current user profile |

### Blog

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/blog/posts/` | List all published posts |
| `GET` | `/api/blog/posts/{slug}/` | Get a single post |
| `GET` | `/api/blog/categories/` | List all categories |
| `GET` | `/api/blog/tags/` | List all tags |

### Tracker Tables

| Method | Endpoint | Description |
|---|---|---|
| `GET/POST` | `/api/tables/` | List or create tracker tables |
| `GET/PUT/DELETE` | `/api/tables/{id}/` | Retrieve, update, or delete a table |
| `GET/POST` | `/api/tables/{id}/entries/` | List or create entries in a table |

---

## Deployment

### Backend — Render.com

The `render.yaml` file defines all Render services. On every push to `main`:

1. Render installs Python deps via `pip install -r requirements.txt`.
2. The build command runs `python manage.py collectstatic --noinput && python manage.py migrate`.
3. Gunicorn starts via the `Procfile`: `web: gunicorn core.wsgi`.

Required environment variables must be set in the Render dashboard.

### Frontend — Vercel

Connect the GitHub repository to Vercel, set the **root directory** to `frontend`, and add the environment variables listed above. Vercel auto-deploys on every push to `main`.

### Docker (self-hosted)

```bash
docker build -t positive-theta-backend .
docker run -p 8000:8000 --env-file backend/.env positive-theta-backend
```

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature`.
3. Commit your changes: `git commit -m "feat: add your feature"`.
4. Push the branch: `git push origin feature/your-feature`.
5. Open a Pull Request.

Please follow the existing code style and add tests for new functionality where applicable.

---

## License

This project is licensed under the **ISC License**. See [LICENSE](LICENSE) for details.
