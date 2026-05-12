import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(tenantId: string, from: Date, to: Date) {
    const db = this.prisma.forTenant(tenantId);

    const [total, byStatus, byService, byBarber] = await Promise.all([
      // @ts-ignore
      db.appointment.count({
        where: { tenantId, scheduledAt: { gte: from, lte: to } },
      }),
      // @ts-ignore
      db.appointment.groupBy({
        by: ['status'],
        where: { tenantId, scheduledAt: { gte: from, lte: to } },
        _count: { _all: true },
      }),
      // @ts-ignore
      db.appointment.groupBy({
        by: ['serviceId'],
        where: { tenantId, scheduledAt: { gte: from, lte: to }, status: 'CONFIRMED' },
        _count: { _all: true },
        orderBy: { _count: { serviceId: 'desc' } },
        take: 5,
      }),
      // @ts-ignore
      db.appointment.groupBy({
        by: ['barberId'],
        where: { tenantId, scheduledAt: { gte: from, lte: to }, status: 'CONFIRMED' },
        _count: { _all: true },
        orderBy: { _count: { barberId: 'desc' } },
      }),
    ]);

    const serviceIds = byService.map((s: { serviceId: string }) => s.serviceId);
    const barberIds = byBarber.map((b: { barberId: string }) => b.barberId);

    const [services, barbers] = await Promise.all([
      // @ts-ignore
      db.service.findMany({
        where: { id: { in: serviceIds } },
        select: { id: true, name: true, priceLocal: true },
      }),
      // @ts-ignore
      db.barber.findMany({
        where: { id: { in: barberIds } },
        select: { id: true, name: true },
      }),
    ]);

    const serviceMap = new Map(services.map((s: { id: string; name: string; priceLocal: unknown }) => [s.id, s]));
    const barberMap = new Map(barbers.map((b: { id: string; name: string }) => [b.id, b]));

    const statusMap: Record<string, number> = {};
    for (const row of byStatus) {
      statusMap[row.status] = row._count._all;
    }

    const noShowRate = total > 0 ? ((statusMap['NO_SHOW'] ?? 0) / total) * 100 : 0;

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      total,
      confirmed: statusMap['CONFIRMED'] ?? 0,
      cancelled: statusMap['CANCELLED'] ?? 0,
      noShow: statusMap['NO_SHOW'] ?? 0,
      noShowRate: Math.round(noShowRate * 10) / 10,
      topServices: byService.map((s: { serviceId: string; _count: { _all: number } }) => ({
        service: serviceMap.get(s.serviceId),
        count: s._count._all,
      })),
      byBarber: byBarber.map((b: { barberId: string; _count: { _all: number } }) => ({
        barber: barberMap.get(b.barberId),
        count: b._count._all,
      })),
    };
  }

  async getDailyBreakdown(tenantId: string, from: Date, to: Date) {
    const db = this.prisma.forTenant(tenantId);
    // @ts-ignore
    const rows = await db.appointment.findMany({
      where: { tenantId, scheduledAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
      select: { scheduledAt: true, status: true },
      orderBy: { scheduledAt: 'asc' },
    });

    const dailyMap = new Map<string, { confirmed: number; noShow: number }>();
    for (const row of rows) {
      const key = row.scheduledAt.toISOString().slice(0, 10);
      if (!dailyMap.has(key)) dailyMap.set(key, { confirmed: 0, noShow: 0 });
      const day = dailyMap.get(key)!;
      if (row.status === 'CONFIRMED') day.confirmed++;
      if (row.status === 'NO_SHOW') day.noShow++;
    }

    return Array.from(dailyMap.entries()).map(([date, counts]) => ({ date, ...counts }));
  }

  async exportCsv(tenantId: string, from: Date, to: Date): Promise<string> {
    const db = this.prisma.forTenant(tenantId);
    // @ts-ignore
    const appointments = await db.appointment.findMany({
      where: { tenantId, scheduledAt: { gte: from, lte: to } },
      include: {
        customer: { select: { name: true, whatsappPhone: true } },
        barber: { select: { name: true } },
        service: { select: { name: true, priceLocal: true, currency: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    const header = 'Fecha,Hora,Cliente,Teléfono,Barbero,Servicio,Precio,Moneda,Estado\n';
    const rows = appointments.map((a: {
      scheduledAt: Date;
      customer: { name: string | null; whatsappPhone: string };
      barber: { name: string };
      service: { name: string; priceLocal: unknown; currency: string };
      status: string;
    }) => {
      const d = a.scheduledAt;
      const date = d.toISOString().slice(0, 10);
      const time = d.toISOString().slice(11, 16);
      const name = (a.customer.name ?? '').replace(/,/g, ' ');
      const phone = a.customer.whatsappPhone;
      return `${date},${time},${name},${phone},${a.barber.name},${a.service.name},${a.service.priceLocal},${a.service.currency},${a.status}`;
    });

    return header + rows.join('\n');
  }
}
