import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { getTenantClient, type TenantClient } from '@barberflow/db';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log:
        process.env['NODE_ENV'] === 'development'
          ? ['warn', 'error']
          : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Returns a tenant-scoped Prisma client.
   * All queries through this client are automatically filtered by RLS
   * using the provided tenantId as the session variable.
   */
  forTenant(tenantId: string): TenantClient {
    return getTenantClient(tenantId);
  }
}
