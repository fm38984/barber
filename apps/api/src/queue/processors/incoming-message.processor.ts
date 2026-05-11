import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantService } from '../../tenant/tenant.service';
import { CustomerService } from '../../customer/customer.service';
import { ConversationService } from '../../conversation/conversation.service';
import { QUEUES, JOB_NAMES } from '../queue.constants';
import type { IncomingMessageJobData } from '../queue.types';

// Forward ref to break the circular dep: BotModule → IncomingMessageProcessor → BotService
// BotModule registers both the processor and BotService, so we use forwardRef / lazy inject.
export const BOT_SERVICE_TOKEN = 'BOT_SERVICE';

export interface IBotService {
  handleIncoming(params: {
    tenant: { id: string; name: string; timezone: string; whatsappPhoneNumberId: string };
    conversation: unknown;
    customer: unknown;
    job: IncomingMessageJobData;
  }): Promise<void>;
}

@Processor(QUEUES.INCOMING_WHATSAPP)
export class IncomingMessageProcessor extends WorkerHost {
  private readonly logger = new Logger(IncomingMessageProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
    private readonly customerService: CustomerService,
    private readonly conversationService: ConversationService,
    @Inject(BOT_SERVICE_TOKEN) private readonly botService: IBotService,
  ) {
    super();
  }

  async process(job: Job<IncomingMessageJobData>): Promise<void> {
    if (job.name !== JOB_NAMES.PROCESS_MESSAGE) return;

    const { phoneNumberId, from, contactName, messageId, timestamp, messageType, textBody, interactiveReply } =
      job.data;

    this.logger.log(
      { phoneNumberId, from, messageId, messageType },
      'Processing incoming WhatsApp message',
    );

    // 1. Resolve tenant from WhatsApp phone_number_id
    const tenant = await this.tenantService.resolveByPhoneNumberId(phoneNumberId);

    if (!tenant) {
      this.logger.warn({ phoneNumberId }, 'No tenant found for phone_number_id — discarding');
      return;
    }

    if (tenant.status === 'SUSPENDED') {
      this.logger.warn({ tenantId: tenant.id }, 'Tenant suspended — discarding message');
      return;
    }

    const tenantId = tenant.id;

    // 2. Upsert customer (scoped by RLS)
    const customer = await this.customerService.upsertByPhone(
      tenantId,
      `+${from}`,
      contactName,
    );

    // 3. Upsert conversation
    const conversation = await this.conversationService.upsertForCustomer(
      tenantId,
      customer.id,
    );

    // 4. Persist incoming message
    const sentAt = new Date(parseInt(timestamp, 10) * 1000);
    const db = this.prisma.forTenant(tenantId);

    // @ts-expect-error — extended client
    await db.message.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        direction: 'IN',
        whatsappMessageId: messageId,
        body: this.extractBody(messageType, textBody, interactiveReply),
        status: 'DELIVERED',
        sentAt,
      },
    });

    // 5. Dispatch to bot state machine
    await this.botService.handleIncoming({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        timezone: tenant.timezone,
        whatsappPhoneNumberId: tenant.whatsappPhoneNumberId,
      },
      conversation,
      customer,
      job: job.data,
    });
  }

  private extractBody(
    type: string,
    textBody?: string,
    interactiveReply?: { button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } },
  ): string {
    if (type === 'text' && textBody) return textBody;
    if (type === 'interactive') {
      if (interactiveReply?.button_reply) {
        return `[button:${interactiveReply.button_reply.id}] ${interactiveReply.button_reply.title}`;
      }
      if (interactiveReply?.list_reply) {
        return `[list:${interactiveReply.list_reply.id}] ${interactiveReply.list_reply.title}`;
      }
    }
    return `[${type}]`;
  }
}
