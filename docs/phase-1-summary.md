# Fase 1 — Resumen: Andamio, Multi-tenancy y Auth

**Fecha de completado:** 2024-01-01  
**Estado:** Completo — pendiente confirmación para avanzar a Fase 2

---

## Qué se construyó

### Monorepo
- Turborepo + pnpm workspaces
- 2 apps: `@barberflow/api` (NestJS), `@barberflow/dashboard` (Next.js 14)
- 3 packages: `@barberflow/db`, `@barberflow/shared-types`, `@barberflow/tsconfig`

### Base de datos
- **Schema Prisma completo** con las 13 tablas del spec
  - 5 tablas de plataforma (sin RLS): `tenants`, `plans`, `subscriptions`, `super_admin_users`, `platform_audit_logs`
  - 8 tablas por tenant (con RLS): `tenant_admins`, `barbers`, `services`, `customers`, `appointments`, `conversations`, `messages`, `reminders`
- **2 migraciones SQL**:
  1. `20240101000000_init`: crea todas las tablas, índices, constraints y FK
  2. `20240101000001_rls`: activa RLS, crea policies de aislamiento, función `current_tenant_id()`
- Todos los índices críticos por `(tenant_id, ...)` están presentes

### Multi-tenancy con RLS
- `getTenantClient(tenantId)` en `packages/db`: wrapping via `$extends` que inyecta `set_config('app.current_tenant_id', id, TRUE)` en cada transacción
- `FORCE ROW LEVEL SECURITY` previene bypass incluso para el owner de la tabla
- Contexto es transaction-local (seguro con pgBouncer y connection pooling)
- Rol `barberflow_platform` (BYPASSRLS) para operaciones de plataforma

### NestJS API
- `PrismaService`: cliente base + método `forTenant(id)` que retorna cliente con RLS activo
- `TenantMiddleware`: verifica JWT de Clerk, resuelve `clerk_user_id → tenant_id → TenantAdmin`
  - Bloquea tenants con estado `SUSPENDED`
  - Distingue `super_admin` (sin tenant context) de `tenant_admin`
- `RolesGuard`: guard global que verifica roles (`super_admin`, `owner`, `manager`) via reflector
- `HealthController`: `GET /api/health` con ping a DB

### Dashboard (Next.js 14 + Clerk)
- `ClerkProvider` con localización `esES`
- Middleware de Clerk que protege todas las rutas excepto `/sign-in` y `/sign-up`
- Páginas: sign-in, sign-up, dashboard (placeholder)
- Redirige a `/sign-in` si no autenticado

### CI (GitHub Actions)
- 3 jobs: `lint-typecheck`, `test`, `build`
- `test` levanta Postgres 16 como service y ejecuta migraciones + tests de aislamiento
- Cachea pnpm store y node_modules

---

## Qué se probó

### Test de aislamiento de tenant (`test/tenant-isolation.spec.ts`)
6 casos de prueba con Vitest + Prisma real contra DB de test:

| Test | Verifica |
|------|----------|
| Tenant A solo ve barberos de A | RLS filtra por `tenant_id` |
| Tenant B solo ve barberos de B | Idem, tenant distinto |
| Tenant A no puede leer barbero B por ID | `findUnique` retorna null (no throws) |
| Tenant B no puede acceder a clientes de A | `findMany` retorna solo registros propios |
| Tenant A no puede modificar servicio de B | `updateMany` afecta 0 filas |
| Sin contexto → tablas vacías | `current_tenant_id()` retorna NULL |

---

## Decisiones tomadas

| Decisión | Ver |
|----------|-----|
| Turborepo + pnpm workspaces | [ADR 001](adr/001-monorepo-turborepo-pnpm.md) |
| Clerk para auth | [ADR 002](adr/002-auth-clerk.md) |
| RLS con set_config transaction-local | [ADR 003](adr/003-rls-shared-schema.md) |

---

## Deuda técnica pendiente

1. **Seed de datos**: no hay `prisma/seed.ts`. Necesario antes de Fase 4 para onboarding rápido.
2. **`@barberflow/db` genera cliente en `node_modules/.prisma`**: requiere que `pnpm db:generate` corra antes de typecheck. El CI lo hace; localmente hay que recordarlo.
3. **Dashboard**: solo scaffold. La UI real se construye en Fase 4.
4. **Rate limiting**: pendiente para Fase 8. Por ahora no hay límites por IP ni por tenant.
5. **Sentry**: configurado en `.env.example` pero no integrado hasta Fase 8.

---

## Cómo correr local (resumen rápido)

```bash
# 1. Servicios
docker compose up -d postgres postgres_test redis

# 2. Dependencias + Prisma
pnpm install
pnpm db:generate
pnpm db:migrate:deploy

# 3. Dev
pnpm dev

# 4. Tests de aislamiento
pnpm test:integration
```
