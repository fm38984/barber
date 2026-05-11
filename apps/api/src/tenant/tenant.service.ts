import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ResolvedTenant } from '@barberflow/shared-types';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves a tenant by the WhatsApp phone_number_id that received the message.
   * Used by the webhook processor to identify which tenant a message belongs to.
   */
  async resolveByPhoneNumberId(
    phoneNumberId: string,
  ): Promise<ResolvedTenant | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { whatsappPhoneNumberId: phoneNumberId },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        timezone: true,
        whatsappPhoneNumberId: true,
      },
    });
    return tenant;
  }

  /**
   * Resolves a tenant by its ID.
   * Used by the dashboard auth middleware after Clerk validates the JWT.
   */
  async resolveById(tenantId: string): Promise<ResolvedTenant> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        timezone: true,
        whatsappPhoneNumberId: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    return tenant;
  }

  /**
   * Resolves the tenant for a Clerk user.
   * Looks up the TenantAdmin record associated with the Clerk user ID.
   * Returns both the tenant and the admin's role.
   */
  async resolveByClerkUserId(clerkUserId: string): Promise<{
    tenant: ResolvedTenant;
    adminId: string;
    role: 'OWNER' | 'MANAGER';
  } | null> {
    const admin = await this.prisma.tenantAdmin.findUnique({
      where: { clerkUserId },
      include: {
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true,
            status: true,
            timezone: true,
            whatsappPhoneNumberId: true,
          },
        },
      },
    });

    if (!admin) return null;

    return {
      tenant: admin.tenant,
      adminId: admin.id,
      role: admin.role,
    };
  }
}
