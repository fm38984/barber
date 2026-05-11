# BarberFlow

SaaS multi-tenant para gestión de citas de barberías vía WhatsApp.

## Estructura del monorepo

```
barberflow/
├── apps/
│   ├── api/          # Backend NestJS (puerto 3001)
│   └── dashboard/    # Frontend Next.js 14 (puerto 3000)
├── packages/
│   ├── db/           # Prisma schema + cliente con soporte RLS
│   ├── shared-types/ # Tipos TypeScript compartidos
│   └── tsconfig/     # Configuraciones TS base
├── docs/
│   ├── adr/          # Architecture Decision Records
│   └── phase-*.md    # Resúmenes de fase
└── docker-compose.yml
```

## Requisitos

- **Node.js** >= 20
- **pnpm** >= 9 (`npm install -g pnpm`)
- **Docker** + Docker Compose (para Postgres y Redis local)

## Setup local

### 1. Clonar e instalar dependencias

```bash
git clone <repo>
cd barberflow
pnpm install
```

### 2. Variables de entorno

```bash
cp .env.example .env
# Edita .env con tus valores reales
```

Variables mínimas para desarrollo:
```
DATABASE_URL=postgresql://barberflow:password@localhost:5432/barberflow
DIRECT_DATABASE_URL=postgresql://barberflow:password@localhost:5432/barberflow
REDIS_URL=redis://localhost:6379
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### 3. Levantar servicios locales

```bash
docker compose up -d postgres redis
```

### 4. Ejecutar migraciones

```bash
pnpm db:migrate:deploy
# O para desarrollo (permite modificar migraciones):
pnpm db:migrate:dev
```

### 5. Generar cliente Prisma

```bash
pnpm db:generate
```

### 6. Iniciar en modo desarrollo

```bash
# Inicia API (3001) y Dashboard (3000) con hot reload
pnpm dev
```

## Tests

```bash
# Tests unitarios
pnpm test

# Tests de aislamiento de tenant (requiere postgres_test en docker)
docker compose up -d postgres_test
pnpm test:integration
```

## Configurar Clerk

1. Crear cuenta en [clerk.com](https://clerk.com)
2. Crear una nueva aplicación
3. Copiar `CLERK_SECRET_KEY` y `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` a `.env`
4. En Clerk Dashboard > Sessions > Customize session token, agregar:
   ```json
   { "role": "{{user.public_metadata.role}}" }
   ```
5. Para el super-admin: en Clerk Dashboard, editar el usuario y agregar en Public Metadata:
   ```json
   { "role": "super_admin" }
   ```

## Onboarding de un tenant nuevo

1. Crear el tenant en la tabla `tenants` (via super-admin panel en Fase 7)
2. Crear el admin inicial en `tenant_admins`
3. Crear el usuario en Clerk con el email del admin
4. Actualizar `tenant_admins.clerk_user_id` con el ID de Clerk
5. Registrar el `whatsapp_phone_number_id` del número de WhatsApp Business

## Arquitectura de seguridad (RLS)

Todos los datos por tenant están protegidos por Row-Level Security de Postgres.
Ver [ADR 003](docs/adr/003-rls-shared-schema.md) para detalles de implementación.

El flujo de cada request autenticada:

```
Request → TenantMiddleware (verifica JWT Clerk)
        → Resuelve tenant_id del clerk_user_id
        → Verifica que el tenant está ACTIVE
        → Inyecta req.tenantId
        
Controller → prismaService.forTenant(req.tenantId)
           → getTenantClient(tenantId)
           → SET LOCAL app.current_tenant_id = tenantId
           → Query ejecutada con RLS activo
```

## Fases de construcción

- [x] **Fase 1** — Monorepo, multi-tenancy, auth
- [ ] **Fase 2** — Integración WhatsApp Business Cloud API
- [ ] **Fase 3** — Bot conversacional (máquina de estados)
- [ ] **Fase 4** — Dashboard de barbería
- [ ] **Fase 5** — Recordatorios y notificaciones
- [ ] **Fase 6** — Reportes
- [ ] **Fase 7** — Billing y super-admin
- [ ] **Fase 8** — Hardening pre-producción
