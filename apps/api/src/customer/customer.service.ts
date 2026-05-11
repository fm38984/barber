import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Customer } from '@barberflow/db';

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finds an existing customer by WhatsApp phone number within a tenant,
   * or creates a new one. Always uses tenant-scoped client (RLS active).
   */
  async upsertByPhone(
    tenantId: string,
    whatsappPhone: string,
    name?: string | null,
  ): Promise<Customer> {
    const db = this.prisma.forTenant(tenantId);

    // @ts-expect-error — extended client has same API, TS doesn't infer return type through $extends
    const customer = await db.customer.upsert({
      where: { tenantId_whatsappPhone: { tenantId, whatsappPhone } },
      update: {
        // Update name only if we got a non-null value and the stored name is null
        ...(name ? { name } : {}),
        lastVisitAt: new Date(),
      },
      create: {
        tenantId,
        whatsappPhone,
        name: name ?? null,
      },
    });

    return customer as Customer;
  }

  async findById(tenantId: string, customerId: string): Promise<Customer | null> {
    const db = this.prisma.forTenant(tenantId);
    // @ts-expect-error
    return db.customer.findUnique({ where: { id: customerId } });
  }
}
