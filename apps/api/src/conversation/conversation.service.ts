import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Conversation } from '@barberflow/db';

export interface ConversationState {
  state: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finds the active conversation for a customer, or creates one in IDLE state.
   * One conversation per (tenant, customer) — conversations are long-lived.
   */
  async upsertForCustomer(
    tenantId: string,
    customerId: string,
  ): Promise<Conversation> {
    const db = this.prisma.forTenant(tenantId);

    // @ts-expect-error
    const conversation = await db.conversation.upsert({
      where: { tenantId_customerId: { tenantId, customerId } },
      update: { lastMessageAt: new Date() },
      create: {
        tenantId,
        customerId,
        stateJson: { state: 'IDLE' },
        status: 'ACTIVE',
        lastMessageAt: new Date(),
      },
    });

    return conversation as Conversation;
  }

  async updateState(
    tenantId: string,
    conversationId: string,
    newState: ConversationState,
  ): Promise<Conversation> {
    const db = this.prisma.forTenant(tenantId);

    // @ts-expect-error
    return db.conversation.update({
      where: { id: conversationId },
      data: { stateJson: newState as object, lastMessageAt: new Date() },
    });
  }

  async findByCustomer(
    tenantId: string,
    customerId: string,
  ): Promise<Conversation | null> {
    const db = this.prisma.forTenant(tenantId);
    // @ts-expect-error
    return db.conversation.findUnique({
      where: { tenantId_customerId: { tenantId, customerId } },
    });
  }

  async markEscalated(tenantId: string, conversationId: string): Promise<void> {
    const db = this.prisma.forTenant(tenantId);
    // @ts-expect-error
    await db.conversation.update({
      where: { id: conversationId },
      data: { status: 'ESCALATED' },
    });
  }

  async markActive(tenantId: string, conversationId: string): Promise<void> {
    const db = this.prisma.forTenant(tenantId);
    // @ts-expect-error
    await db.conversation.update({
      where: { id: conversationId },
      data: { status: 'ACTIVE' },
    });
  }
}
