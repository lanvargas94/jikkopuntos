# Despliegue (MVP Jikko)

## Requisitos

- Node.js 20+
- npm o pnpm
- Para Docker: Docker Engine + Docker Compose v2

## Variables de entorno (backend)

Ver `backend/.env.example`. Mínimo:

- `DATABASE_URL` — en local SQLite: `file:./dev.db`
- `JWT_ACCESS_SECRET` o `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `FRONTEND_ORIGIN` — URL del frontend (CORS)

Producción: definir `TRUST_PROXY=1` si la app queda detrás de nginx/ELB y se requiere IP real para auditoría.

## Puesta en marcha sin Docker

```bash
cd backend
cp .env.example .env   # editar secretos
npm ci
npx prisma db push
npx prisma db seed
npm run start:dev
```

API: `http://localhost:4000/api` — Swagger: `http://localhost:4000/api/docs`

```bash
cd frontend
npm ci
# debe coincidir con el puerto del API (por defecto 4000)
# VITE_API_URL=http://localhost:4000/api
npm run dev
```

Usuario seed admin (por defecto): `admin@jikkosoft.local` / `Admin123!` (cambiar tras el primer despliegue).

## Docker Compose (local)

Desde la raíz del repositorio:

```bash
docker compose up --build
```

- API: `http://localhost:4000/api`
- Frontend estático: `http://localhost:8080` (nginx sirve el build de Vite; `VITE_API_URL` por defecto apunta al API en el host).

La primera vez, dentro del contenedor backend se ejecuta `prisma db push`. Para datos iniciales:

```bash
docker compose exec backend npx prisma db seed
```

**Nota:** la imagen de producción usa SQLite en volumen. Para entornos reales, sustituir por PostgreSQL y usar migraciones (`prisma migrate deploy`), no `db push`.

## Imágenes

- `backend/Dockerfile` — build multi-etapa Nest + Prisma.
- `frontend/Dockerfile` — build Vite + nginx para SPA.

## Seguridad rápida

- Helmet activo; CSP desactivada en MVP para Swagger UI (ajustar en endurecimiento).
- Errores internos no filtran stack al cliente.
- Auditoría en tabla `SecurityAuditLog` para acciones clave (login, formularios, puntos, etc.).
