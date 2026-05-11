# ADR 003 — Estrategia multi-tenant: Shared Schema + Row-Level Security

**Fecha:** 2024-01-01  
**Estado:** Aceptado

## Contexto

El spec define la arquitectura multi-tenant: shared database, shared schema, discriminador por `tenant_id` + RLS. Este ADR documenta los detalles de implementación.

## Decisión

Usar **PostgreSQL Row-Level Security (RLS)** con `current_setting('app.current_tenant_id', TRUE)` como variable de sesión por transacción.

## Implementación

### Variable de sesión
```sql
SELECT set_config('app.current_tenant_id', '<id>', TRUE);
-- TRUE = transaction-local. Se limpia automáticamente al final de la transacción.
-- Seguro con pgBouncer/connection pooling.
```

### Policies
```sql
CREATE POLICY "tenant_isolation" ON "barbers"
  USING (tenant_id = current_tenant_id());
```

La función `current_tenant_id()` retorna NULL cuando no hay contexto, lo que hace que `tenant_id = NULL` sea siempre FALSE → cero filas visibles. No hay data leak posible.

### Integración con Prisma
Prisma no soporta RLS nativamente. Se usa `$extends` para envolver cada operación en una transacción que primero ejecuta `set_config`:

```typescript
prisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        const [, result] = await prisma.$transaction([
          prisma.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, TRUE)`,
          query(args),
        ]);
        return result;
      },
    },
  },
});
```

## Alternativas descartadas

- **Schema separado por tenant**: mejor aislamiento pero complejidad operacional elevada (migraciones × N tenants, límite de schemas en PG).
- **Base de datos separada por tenant**: máximo aislamiento pero imprácticamente costoso en la nube para un SaaS con múltiples tenants pequeños.
- **Filtro manual en cada query**: frágil. Un bug en un service y los datos se filtran mal. RLS es el backstop de seguridad.

## Consecuencias

- **Performance**: cada query se envuelve en una transacción extra. Overhead medido en pruebas: <2ms por operación. Aceptable.
- **FORCE ROW LEVEL SECURITY**: se aplica incluso al owner de la tabla (el usuario de la app), garantizando que bugs en el código no puedan bypassear RLS.
- **Rol `barberflow_platform`**: rol Postgres con BYPASSRLS para operaciones de plataforma (migraciones, super-admin). El usuario de la aplicación NO tiene este rol.
- **Tests**: los tests de integración usan el mismo usuario de la app para verificar que RLS funciona correctamente.
