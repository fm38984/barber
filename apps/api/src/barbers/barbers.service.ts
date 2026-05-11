import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBarberDto } from './dto/create-barber.dto';

@Injectable()
export class BarbersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const db = this.prisma.forTenant(tenantId);
    // @ts-expect-error
    return db.barber.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(tenantId: string, id: string) {
    const db = this.prisma.forTenant(tenantId);
    // @ts-expect-error
    const barber = await db.barber.findUnique({ where: { id } });
    if (!barber) throw new NotFoundException('Barbero no encontrado');
    return barber;
  }

  async create(tenantId: string, dto: CreateBarberDto) {
    const db = this.prisma.forTenant(tenantId);
    // @ts-expect-error
    return db.barber.create({ data: { tenantId, ...dto, workingHoursJson: dto.workingHoursJson ?? {} } });
  }

  async update(tenantId: string, id: string, dto: Partial<CreateBarberDto>) {
    const db = this.prisma.forTenant(tenantId);
    // @ts-expect-error
    const existing = await db.barber.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Barbero no encontrado');
    // @ts-expect-error
    return db.barber.update({ where: { id }, data: dto });
  }

  async deactivate(tenantId: string, id: string) {
    const db = this.prisma.forTenant(tenantId);
    // @ts-expect-error
    return db.barber.update({ where: { id }, data: { status: 'INACTIVE' } });
  }
}
