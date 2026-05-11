import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
  Logger,
  Version,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { WhatsAppSignatureGuard } from './whatsapp-signature.guard';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';
import type { WhatsAppWebhookPayload } from '@barberflow/shared-types';

@Controller('webhooks/whatsapp')
@Version('1')
@SkipThrottle()
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(private readonly webhookService: WhatsAppWebhookService) {}

  /**
   * GET /api/v1/webhooks/whatsapp
   *
   * Meta verification handshake. When you configure the webhook URL in the
   * Meta developer portal, Meta sends a GET request with these params.
   * We must respond with the hub.challenge value to confirm ownership.
   */
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const expectedToken = process.env['WHATSAPP_VERIFY_TOKEN'];

    if (!expectedToken) {
      this.logger.error('WHATSAPP_VERIFY_TOKEN not set');
      throw new BadRequestException('Webhook no configurado');
    }

    if (mode === 'subscribe' && token === expectedToken) {
      this.logger.log('WhatsApp webhook verification successful');
      return challenge;
    }

    this.logger.warn({ mode, token }, 'Webhook verification failed — token mismatch');
    throw new BadRequestException('Token de verificación inválido');
  }

  /**
   * POST /api/v1/webhooks/whatsapp
   *
   * Receives incoming messages and status updates from Meta.
   * Signature is verified by WhatsAppSignatureGuard before this handler runs.
   * Must respond 200 immediately — processing happens asynchronously via BullMQ.
   */
  @Post()
  @UseGuards(WhatsAppSignatureGuard)
  @HttpCode(HttpStatus.OK)
  async receive(@Body() payload: WhatsAppWebhookPayload): Promise<void> {
    if (payload.object !== 'whatsapp_business_account') {
      this.logger.warn({ object: payload.object }, 'Unexpected webhook object type');
      return;
    }

    // Fire and forget — BullMQ handles retries and error handling
    this.webhookService.handleWebhook(payload).catch((err: unknown) => {
      this.logger.error({ err }, 'Error dispatching webhook to queue');
    });
  }
}
