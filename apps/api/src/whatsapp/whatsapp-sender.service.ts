import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  OutgoingMessage,
  MetaSendResponse,
} from '@barberflow/shared-types';

const META_API_BASE = 'https://graph.facebook.com';

@Injectable()
export class WhatsAppSenderService {
  private readonly logger = new Logger(WhatsAppSenderService.name);
  private readonly apiVersion = process.env['WHATSAPP_API_VERSION'] ?? 'v20.0';
  private readonly accessToken = process.env['WHATSAPP_ACCESS_TOKEN'] ?? '';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sends a message via Meta Cloud API and persists it in the messages table.
   */
  async send(
    tenantId: string,
    conversationId: string,
    phoneNumberId: string,
    message: OutgoingMessage,
  ): Promise<string> {
    const payload = this.buildPayload(message);

    const url = `${META_API_BASE}/${this.apiVersion}/${phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error({ phoneNumberId, status: response.status, error }, 'Meta API send failed');
      throw new InternalServerErrorException('Error al enviar mensaje de WhatsApp');
    }

    const data = (await response.json()) as MetaSendResponse;
    const whatsappMessageId = data.messages[0]?.id ?? null;

    // Persist outgoing message
    const db = this.prisma.forTenant(tenantId);
    // @ts-expect-error
    await db.message.create({
      data: {
        tenantId,
        conversationId,
        direction: 'OUT',
        whatsappMessageId,
        body: this.extractBodyText(message),
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    this.logger.log({ tenantId, whatsappMessageId, to: message.to }, 'Message sent');
    return whatsappMessageId ?? '';
  }

  private buildPayload(message: OutgoingMessage): Record<string, unknown> {
    const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to: message.to };

    switch (message.type) {
      case 'text':
        return {
          ...base,
          type: 'text',
          text: { body: message.text, preview_url: message.previewUrl ?? false },
        };

      case 'interactive_buttons':
        return {
          ...base,
          type: 'interactive',
          interactive: {
            type: 'button',
            ...(message.header ? { header: { type: 'text', text: message.header } } : {}),
            body: { text: message.body },
            ...(message.footer ? { footer: { text: message.footer } } : {}),
            action: {
              buttons: message.buttons.map((b) => ({
                type: 'reply',
                reply: { id: b.id, title: b.title },
              })),
            },
          },
        };

      case 'interactive_list':
        return {
          ...base,
          type: 'interactive',
          interactive: {
            type: 'list',
            ...(message.header ? { header: { type: 'text', text: message.header } } : {}),
            body: { text: message.body },
            ...(message.footer ? { footer: { text: message.footer } } : {}),
            action: {
              button: message.buttonText,
              sections: message.sections.map((s) => ({
                ...(s.title ? { title: s.title } : {}),
                rows: s.rows,
              })),
            },
          },
        };

      case 'template':
        return {
          ...base,
          type: 'template',
          template: {
            name: message.templateName,
            language: { code: message.languageCode },
            ...(message.components ? { components: message.components } : {}),
          },
        };
    }
  }

  private extractBodyText(message: OutgoingMessage): string {
    switch (message.type) {
      case 'text': return message.text;
      case 'interactive_buttons': return message.body;
      case 'interactive_list': return message.body;
      case 'template': return `[template:${message.templateName}]`;
    }
  }
}
