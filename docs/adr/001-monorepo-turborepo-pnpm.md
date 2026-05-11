# ADR 001 — Monorepo: Turborepo + pnpm workspaces

**Fecha:** 2024-01-01  
**Estado:** Aceptado

## Contexto

El proyecto necesita un monorepo que contenga el backend (NestJS), el frontend (Next.js) y paquetes compartidos (tipos, cliente Prisma). Hay dos opciones principales: solo pnpm workspaces o pnpm + Turborepo.

## Decisión

Usar **pnpm workspaces** como gestor de paquetes y **Turborepo** como orquestador de pipeline de build/test.

## Razón

- **pnpm** resuelve el problema de `node_modules` duplicados mejor que npm/yarn. Esencial en monorepos.
- **Turborepo** añade caching inteligente: si `packages/db` no cambió, no reconstruye `@barberflow/api`. Ahorra 60-80% del tiempo de CI en PRs cotidianos.
- Son complementarios: pnpm gestiona dependencias, Turborepo gestiona ejecución de tareas.

## Alternativas descartadas

- **Nx**: más potente pero mayor curva de aprendizaje. Turborepo es suficiente para este scope.
- **Solo pnpm workspaces**: funciona pero sin caching, CI siempre reconstruye todo.

## Consecuencias

- Requiere `turbo.json` para declarar el grafo de dependencias de tareas.
- Los `package.json` de cada app/package deben declarar dependencias internas como `"workspace:*"`.
