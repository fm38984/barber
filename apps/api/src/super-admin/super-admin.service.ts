import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateTenantDto {
  name: string;
  slug: string;
  planId: string;
  timezone: string;
  whatsappPhoneNumberId?: string;
  whatsappAccessToken?: string;
}

@Injectable()
export class SuperAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listTenants(search?: string) {
    return this.prisma.tenant.findMany({
      where: search
        ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { slug: { contains: search, mode: 'insensitive' } }] }
        : undefined,
      include: { plan: { select: { name: true } }, _count: { select: { barbers: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        plan: true,
        subscription: true,
        _count: { select: { barbers: true, appointments: true, customers: true } },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');
    return tenant;
  }

  async createTenant(dto: CreateTenantDto) {
    return this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        planId: dto.planId,
        timezone: dto.timezone,
        whatsappPhoneNumberId: dto.whatsappPhoneNumberId ?? '',
        whatsappAccessToken: dto.whatsappAccessToken ?? '',
        status: 'ACTIVE',
      },
    });
  }

  async updateTenantStatus(id: string, status: 'ACTIVE' | 'SUSPENDED') {
    return this.prisma.tenant.update({ where: { id }, data: { status } });
  }

  async getPlatformMetrics() {
    const [tenantCount, appointmentCount, customerCount] = await Promise.all([
      this.prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      this.prisma.appointment.count(),
      this.prisma.customer.count(),
    ]);

    const recentAudit = await this.prisma.platformAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return { tenantCount, appointmentCount, customerCount, recentAudit };
  }

  async createAuditLog(actor: string, action: string, targetTenantId?: string, payload?: object) {
    return this.prisma.platformAuditLog.create({
      data: { actor, action, targetTenantId, payload: payload ?? {} },
    });
  }

  async listPlans() {
    return this.prisma.plan.findMany({ orderBy: { priceUsd: 'asc' } });
  }
}
