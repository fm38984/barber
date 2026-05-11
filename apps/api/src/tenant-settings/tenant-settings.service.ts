import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UpdateTenantSettingsDto {
  timezone?: string;
  welcomeMessage?: string;
  reminderHoursBefore?: number[];
}

@Injectable()
export class TenantSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        welcomeMessage: true,
        status: true,
        plan: { select: { name: true, maxBarbers: true, maxAppointmentsMonth: true } },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');
    return tenant;
  }

  async updateSettings(tenantId: string, dto: UpdateTenantSettingsDto) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.welcomeMessage !== undefined && { welcomeMessage: dto.welcomeMessage }),
      },
      select: { id: true, timezone: true, welcomeMessage: true },
    });
  }
}
