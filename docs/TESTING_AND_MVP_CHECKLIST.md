# Pruebas recomendadas y checklist de salida MVP

## Pruebas unitarias (recomendado)

- **AuthService**: login éxito/fallo, `changePassword` (política, historial, transacción con auditoría).
- **AuditService**: serialización de `metadata`, truncado de `userAgent`.
- **FormsService**: publicación desde borrador, cierre, envío con y sin recompensa de puntos (mocks a Prisma / `JikkoPointsService`).
- **UsersService**: creación de colaborador, conflictos email/cédula.
- **Utilidades**: `sanitize-input`, `request-audit.util`.

Herramientas: Jest (ya en el backend), mocks con `@nestjs/testing` y `jest-mock-extended` o dobles manuales de `PrismaService`.

## Pruebas de integración / E2E

- **Supertest** contra `AppModule` o app levantada en memoria:
  - Login admin → `GET /auth/me`.
  - Admin crea colaborador → login colaborador → `PATCH` perfil.
  - Flujo formulario: crear borrador → publicar → `GET` share público → enviar respuesta → verificar auditoría y transacción de puntos en BD SQLite de test (`DATABASE_URL` temporal).
- Separar base de datos de test (`:memory:` o archivo en `/tmp`) y ejecutar `prisma db push` en `beforeAll`.

## Checklist de salida a MVP

- [ ] Variables de entorno documentadas (`.env.example`) y secretos rotados en producción.
- [ ] `JWT_REFRESH_SECRET` y `JWT_ACCESS_SECRET` distintos y suficientemente largos.
- [ ] CORS: `FRONTEND_ORIGIN` apunta solo a orígenes reales.
- [ ] `TRUST_PROXY=1` solo si hay proxy que inyecta `X-Forwarded-For` de confianza.
- [ ] HTTPS terminado en proxy o en app; cookies/tokens nunca en query string.
- [ ] SQLite aceptable solo para pilotos; producción: migrar a PostgreSQL y `prisma migrate deploy`.
- [ ] Revisar `SWAGGER_DISABLED=1` en producción si la superficie de documentación no debe ser pública.
- [ ] Backups de BD y prueba de restauración.
- [ ] Logs centralizados (stdout agregado) y alertas en errores 5xx.
- [ ] Revisión de límites de rate limiting (`@nestjs/throttler`) en rutas públicas.
- [ ] Política de retención / acceso a `SecurityAuditLog` y `ProfileChangeLog` (RGPD / interno).
