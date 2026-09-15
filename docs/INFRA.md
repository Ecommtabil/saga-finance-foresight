# Infra local

## Subir stack

```bash
cp .env.example .env
docker compose up --build
```

- App: http://localhost:3000
- ETL: http://localhost:8000/health
- Postgres: localhost:5432 (user/pass/db: `saga`)

## Schema

Migrations em `db/migrations/` são aplicadas no primeiro boot do Postgres.

## API key

Todas as rotas (exceto `/health`) exigem header `X-API-Key` (default `dev-etl-key`).
