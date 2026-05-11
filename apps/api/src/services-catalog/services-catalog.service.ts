import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';

@Injectable()
export class ServicesCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const db = this.prisma.forTenant(tenantId);
    // @ts-expect-error
    return db.service.findMany({ orderBy: { name: 'asc' } });
  }

  async create(tenantId: string, dto: CreateServiceDto) {
    const db = this.prisma.forTenant(tenantId);
    // @ts-expect-error
    return db.service.create({ data: { tenantId, ...dto, currency: dto.currency ?? 'USD' } });
  }

  async update(tenantId: string, id: string, dto: Partial<CreateServiceDto>) {
    const db = this.prisma.forTenant(tenantId);
    // @ts-expect-error
    const existing = await db.service.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Servicio no encontrado');
    // @ts-expect-error
    return db.service.update({ where: { id }, data: dto });
  }

  async deactivate(tenantId: string, id: string) {
    const db = this.prisma.forTenant(tenantId);
    // @ts-expect-error
    return db.service.update({ where: { id }, data: { isActive: false } });
  }
}
