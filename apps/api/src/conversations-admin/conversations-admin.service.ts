import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConversationsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, status?: string) {
    const db = this.prisma.forTenant(tenantId);
    // @ts-ignore
    return db.conversation.findMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: (status ? { tenantId, status } : { tenantId }) as any,
      include: {
        customer: { select: { id: true, name: true, whatsappPhone: true } },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 50,
    });
  }

  async findOne(tenantId: string, id: string) {
    const db = this.prisma.forTenant(tenantId);
    // @ts-ignore
    const conv = await db.conversation.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, whatsappPhone: true } },
        messages: { orderBy: { createdAt: 'asc' }, take: 100 },
      },
    });
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    return conv;
  }

  async release(tenantId: string, id: string) {
    const db = this.prisma.forTenant(tenantId);
    // @ts-ignore
    return db.conversation.update({
      where: { id },
      data: { status: 'ACTIVE', stateJson: { state: 'IDLE' } },
    });
  }

  async takeControl(tenantId: string, id: string) {
    const db = this.prisma.forTenant(tenantId);
    // @ts-ignore
    return db.conversation.update({
      where: { id },
      data: { status: 'ESCALATED' },
    });
  }
}
