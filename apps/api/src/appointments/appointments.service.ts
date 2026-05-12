import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByWeek(tenantId: string, weekStart: Date) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const db = this.prisma.forTenant(tenantId);
    // @ts-ignore
    return db.appointment.findMany({
      where: { scheduledAt: { gte: weekStart, lt: weekEnd } },
      include: {
        customer: { select: { id: true, name: true, whatsappPhone: true } },
        barber: { select: { id: true, name: true } },
        service: { select: { id: true, name: true, durationMin: true, priceLocal: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findAll(
    tenantId: string,
    opts: { from?: Date; to?: Date; barberId?: string; status?: string; limit?: number; offset?: number },
  ) {
    const db = this.prisma.forTenant(tenantId);
    // @ts-ignore
    return db.appointment.findMany({
      where: {
        ...(opts.from || opts.to
          ? { scheduledAt: { ...(opts.from && { gte: opts.from }), ...(opts.to && { lte: opts.to }) } }
          : {}),
        ...(opts.barberId && { barberId: opts.barberId }),
        ...(opts.status && { status: opts.status }),
      },
      include: {
        customer: { select: { id: true, name: true, whatsappPhone: true } },
        barber: { select: { id: true, name: true } },
        service: { select: { id: true, name: true, durationMin: true } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: opts.limit ?? 50,
      skip: opts.offset ?? 0,
    });
  }

  async update(tenantId: string, id: string, dto: UpdateAppointmentDto) {
    const db = this.prisma.forTenant(tenantId);
    // @ts-ignore
    const existing = await db.appointment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Cita no encontrada');

    // @ts-ignore
    return db.appointment.update({
      where: { id },
      data: {
        ...(dto.status && { status: dto.status }),
        ...(dto.scheduledAt && { scheduledAt: new Date(dto.scheduledAt) }),
        ...(dto.barberId !== undefined && { barberId: dto.barberId }),
      },
    });
  }
}
