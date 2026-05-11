import { PrismaClient } from '@prisma/client';

// Singleton for the base Prisma client (used for platform-level operations)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Returns a Prisma client extension scoped to a specific tenant.
 * Every query executed through this client is wrapped in a transaction
 * that first sets app.current_tenant_id, triggering RLS policies.
 *
 * Usage:
 *   const db = getTenantClient(tenantId);
 *   const barbers = await db.barber.findMany(); // only tenant's barbers
 */
export function getTenantClient(tenantId: string) {
  return prisma.$extends({
    name: `tenant-${tenantId}`,
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          // set_config(key, value, is_local=TRUE) → transaction-local
          // Safe with connection pooling: setting cleared when tx ends
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

export type TenantClient = ReturnType<typeof getTenantClient>;
