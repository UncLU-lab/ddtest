# Demurrage Defender

Demurrage Defender is organized as a single repository with two independently installable applications.

- `apps/web` — Vite and React frontend
- `apps/api` — NestJS and TypeORM API
- `infra/docker-compose.yml` — local PostgreSQL service
- `docs` — project guidance and documentation

## Development

Install dependencies in each application:

```powershell
npm --prefix apps/web install
npm --prefix apps/api ci
```

Run the applications:

```powershell
npm run dev:web
npm run dev:api
```

The web development server proxies `/api` to `http://localhost:3000`.