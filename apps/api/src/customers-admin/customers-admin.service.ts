import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomersAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, opts: { search?: string; limit?: number; offset?: number }) {
    const db = this.prisma.forTenant(tenantId);
    // @ts-expect-error
    return db.customer.findMany({
      where: opts.search
        ? { OR: [{ name: { contains: opts.search, mode: 'insensitive' } }, { whatsappPhone: { contains: opts.search } }] }
        : {},
      select: {
        id: true,
        name: true,
        whatsappPhone: true,
        createdAt: true,
        lastVisitAt: true,
        _count: { select: { appointments: true } },
      },
      orderBy: { lastVisitAt: { sort: 'desc', nulls: 'last' } },
      take: opts.limit ?? 50,
      skip: opts.offset ?? 0,
    });
  }

  async findOneWithHistory(tenantId: string, customerId: string) {
    const db = this.prisma.forTenant(tenantId);
    // @ts-expect-error
    const customer = await db.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');

    // @ts-expect-error
    const appointments = await db.appointment.findMany({
      where: { customerId },
      include: {
        service: { select: { name: true, priceLocal: true, currency: true } },
        barber: { select: { name: true } },
      },
      orderBy: { scheduledAt: 'desc' },
      take: 30,
    });

    return { ...customer, appointments };
  }
}
