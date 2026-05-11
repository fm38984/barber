import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';
import { WhatsAppSenderService } from './whatsapp-sender.service';
import { QUEUES } from '../queue/queue.constants';

// The IncomingMessageProcessor is registered in BotModule to avoid circular deps:
// BotModule → IncomingMessageProcessor → BotService → WhatsAppSenderService → WhatsAppModule

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.INCOMING_WHATSAPP }),
  ],
  controllers: [WhatsAppController],
  providers: [WhatsAppWebhookService, WhatsAppSenderService],
  exports: [WhatsAppSenderService],
})
export class WhatsAppModule {}
