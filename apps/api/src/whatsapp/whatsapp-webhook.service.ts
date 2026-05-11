import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES, JOB_NAMES } from '../queue/queue.constants';
import type { IncomingMessageJobData } from '../queue/queue.types';
import type {
  WhatsAppWebhookPayload,
  WhatsAppChangeValue,
  WhatsAppIncomingMessage,
} from '@barberflow/shared-types';

@Injectable()
export class WhatsAppWebhookService {
  private readonly logger = new Logger(WhatsAppWebhookService.name);

  constructor(
    @InjectQueue(QUEUES.INCOMING_WHATSAPP)
    private readonly incomingQueue: Queue<IncomingMessageJobData>,
  ) {}

  /**
   * Parses the Meta webhook payload and enqueues one job per incoming message.
   * Status updates (delivered/read receipts) are handled separately.
   * Returns immediately — all processing happens asynchronously.
   */
  async handleWebhook(payload: WhatsAppWebhookPayload): Promise<void> {
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') continue;
        await this.processChangeValue(change.value);
      }
    }
  }

  private async processChangeValue(value: WhatsAppChangeValue): Promise<void> {
    const phoneNumberId = value.metadata.phone_number_id;

    // Handle incoming messages
    if (value.messages && value.messages.length > 0) {
      for (const msg of value.messages) {
        // Build contact name from contacts array (parallel to messages array by wa_id)
        const contact = value.contacts?.find((c) => c.wa_id === msg.from);
        const contactName = contact?.profile.name ?? null;

        await this.enqueueIncomingMessage(phoneNumberId, msg, contactName);
      }
    }

    // Handle status updates (delivered/read receipts)
    if (value.statuses && value.statuses.length > 0) {
      for (const status of value.statuses) {
        this.logger.debug(
          { messageId: status.id, status: status.status, recipientId: status.recipient_id },
          'WhatsApp status update received — will be processed in Phase 3',
        );
        // Phase 3: update messages.status in DB
      }
    }
  }

  private async enqueueIncomingMessage(
    phoneNumberId: string,
    msg: WhatsAppIncomingMessage,
    contactName: string | null,
  ): Promise<void> {
    const jobData: IncomingMessageJobData = {
      phoneNumberId,
      from: msg.from,
      contactName,
      messageId: msg.id,
      timestamp: msg.timestamp,
      messageType: msg.type,
      textBody: msg.text?.body,
      interactiveReply: msg.interactive,
    };

    await this.incomingQueue.add(JOB_NAMES.PROCESS_MESSAGE, jobData, {
      // Use messageId as jobId to prevent duplicate processing on retries
      jobId: `wa-msg-${msg.id}`,
    });

    this.logger.debug(
      { phoneNumberId, from: msg.from, messageId: msg.id, type: msg.type },
      'Incoming message enqueued',
    );
  }
}
