# ADR 002 — Autenticación del dashboard: Clerk

**Fecha:** 2024-01-01  
**Estado:** Aceptado

## Contexto

El dashboard de administración necesita auth. Las opciones mencionadas en el spec son Clerk y Auth0. Los clientes finales NO tienen login (usan WhatsApp).

## Decisión

Usar **Clerk** para autenticar a los admins de barbería y al super-admin.

## Razón

- **Next.js App Router nativo**: Clerk ofrece middleware, `auth()`, `currentUser()` con soporte de primera clase para App Router. Auth0 requiere más boilerplate.
- **Tier gratuito generoso**: 10,000 MAU gratuitos. Suficiente para MVP y early customers.
- **Metadata de usuario**: Clerk permite almacenar metadata custom en el JWT (e.g., `role: "super_admin"`). Se usa para distinguir super_admin de tenant_admin sin una query extra.
- **Component library**: `<SignIn>`, `<SignUp>`, `<UserButton>` out of the box. Ahorra Fase 4 semanas de UI.

## Alternativas descartadas

- **Auth0**: más flexible para flows complejos pero más costoso y más boilerplate con Next.js App Router.
- **JWT propio**: más control pero gestionar refresh tokens, revocación y seguridad es deuda técnica innecesaria en MVP.

## Implementación

- Cada tenant_admin tiene un `clerk_user_id` en la tabla `tenant_admins`.
- El super_admin tiene `role: "super_admin"` en sus public metadata de Clerk.
- El middleware de NestJS verifica el JWT de Clerk con `@clerk/backend` y resuelve el tenant.

## Consecuencias

- Dependencia de tercero para auth. Mitigación: el `clerk_user_id` es solo un identificador; se puede migrar a otra solución cambiando únicamente el middleware.
- Clerk cobra por MAU sobre el tier gratuito. Con crecimiento, evaluar si migrar a Auth0 o solución propia.
