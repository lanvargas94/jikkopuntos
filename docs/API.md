# API técnica (MVP Jikko)

Base URL local (por defecto): `http://localhost:4000/api` (`PORT` en el backend).

Documentación interactiva: `http://localhost:4000/api/docs` (OpenAPI / Swagger), salvo que `SWAGGER_DISABLED=1`.

Autenticación: cabecera `Authorization: Bearer <access_token>`. El login devuelve `accessToken` y `refreshToken`.

## Módulos principales

| Prefijo | Descripción | Público / rol |
|--------|-------------|----------------|
| `POST /auth/login` | Inicio de sesión | Público (rate limit) |
| `POST /auth/refresh` | Renovar tokens | Público |
| `POST /auth/logout` | Revocar refresh | Público |
| `GET /auth/me` | Usuario actual | JWT |
| `POST /auth/change-password` | Cambio de contraseña | JWT |
| `GET/POST/PATCH .../users/...` | Colaboradores (admin) | ADMIN |
| `GET/PATCH .../profile/...` | Hoja de vida colaborador | COLLABORATOR |
| `GET/POST .../forms/...` | Formularios | Mixto: admin vs `GET /forms/share/:token` público |
| `GET .../jikkopuntos/...` | Movimientos / saldo | JWT |

## Auditoría (`SecurityAuditLog`)

Las acciones sensibles se registran con `action` (ver `security-audit.constants.ts`) y `metadata` JSON **sin volúmenes grandes de PII**. Campos opcionales: `ipAddress`, `userAgent` (p. ej. en login).

Consulta directa vía Prisma / base de datos; no hay endpoint de listado en el MVP.

## Códigos HTTP habituales

- `400` Validación (`class-validator`) o regla de negocio.
- `401` No autenticado o token inválido.
- `403` Rol insuficiente (`RolesGuard`).
- `404` / `409` / `410` según recurso (p. ej. formulario cerrado → `410` en vista pública).

## Errores

Respuestas JSON alineadas con Nest (`statusCode`, `message` o detalle de validación). Errores no controlados → `500` con mensaje genérico; detalle en logs del servidor (`GlobalExceptionFilter`).
