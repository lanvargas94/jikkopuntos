# Jikko (MVP)

Portal interno para **Jikkosoft**: autenticación JWT, administración de colaboradores, hoja de vida (perfil), **formularios** con respuestas y **jikkopuntos**.

Monorepo:

| Carpeta     | Stack                          |
|------------|---------------------------------|
| `backend/` | NestJS 10, Prisma 5, SQLite     |
| `frontend/`| React 19, Vite 8, React Router  |

---

## Requisitos

- **Node.js 20+**
- **npm** (recomendado `npm ci` en CI/Docker)
- **Docker Desktop** (opcional, para levantar todo con Compose)

---

## Desarrollo local (sin Docker)

### 1. API

```bash
cd backend
cp .env.example .env
# Edita .env: JWT_ACCESS_SECRET, JWT_REFRESH_SECRET (y opcionalmente PORT; por defecto 4000)
npm ci
npx prisma db push
npx prisma db seed
npm run start:dev
```

- API: **http://localhost:4000/api**
- Salud: **http://localhost:4000/api/health**
- Swagger: **http://localhost:4000/api/docs**

### 2. Frontend

```bash
cd frontend
npm ci
cp .env.example .env   # opcional; por defecto ya apunta a http://localhost:4000/api
npm run dev
```

- App: **http://localhost:5173** (puerto que indique Vite)

### Usuario inicial (seed)

| Campo        | Valor                    |
|-------------|---------------------------|
| Correo      | `admin@jikkosoft.local`   |
| Contraseña  | `Admin123!`               |

Cámbiala tras el primer uso en entornos reales.

---

## Docker Compose

Desde la **raíz** del repo:

```bash
docker compose up --build
```

| Servicio | URL |
|----------|-----|
| Frontend (nginx + build estático) | http://localhost:8080 |
| API | http://localhost:4000/api |

Carga el usuario administrador y roles (hazlo **siempre** la primera vez, o si ves *Credenciales inválidas* con el admin):

```bash
docker compose exec backend npx prisma db seed
```

Contraseña del seed: **`Admin123!`** (mayúscula en **A**, signo **!** al final). El correo es exactamente `admin@jikkosoft.local`.

Detalle de variables, OpenSSL en la imagen del backend y notas de producción: **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

---

## Documentación

- [Despliegue y Docker](./DEPLOYMENT.md)
- [Resumen de API](./docs/API.md)
- [Pruebas y checklist MVP](./docs/TESTING_AND_MVP_CHECKLIST.md)

---

## Scripts útiles

| Ubicación | Comando | Descripción |
|-----------|---------|-------------|
| `backend` | `npm run start:dev` | API en caliente |
| `backend` | `npm run build` / `npm run start:prod` | Build y arranque producción (`dist/src/main.js`) |
| `backend` | `npx prisma studio` | Explorar SQLite |
| `frontend` | `npm run dev` | Vite dev server |
| `frontend` | `npm run build` | Artefacto estático en `dist/` |

---

## Estructura breve

```
backend/   → Nest (auth, users, profile, forms, jikkopoints, auditoría)
frontend/  → SPA (login, admin, colaborador, formularios públicos)
docs/      → API, testing, checklist MVP
```

Licencia y metadatos del paquete: ver `package.json` de cada proyecto.
