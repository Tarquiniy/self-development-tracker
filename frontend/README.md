Positive Theta — frontend на Next.js (App Router)

## Requirements

- Node.js >= 18
- Backend (Django API) доступен по адресу `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_BACKEND_URL`

## Local setup

```bash
cd frontend
npm install

# env
cp .env.example .env.local

# start
npm run dev
```

Open http://localhost:3000

## Build / run

```bash
npm run build
npm run start
```

## Quality checks

```bash
npm run lint
npm run type-check
```
