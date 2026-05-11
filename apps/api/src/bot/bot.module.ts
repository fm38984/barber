import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BotService } from './bot.service';
import { AvailabilityService } from './availability.service';
import { IdleHandler } from './handlers/idle.handler';
import { ChoosingServiceHandler } from './handlers/choosing-service.handler';
import { ChoosingBarberHandler } from './handlers/choosing-barber.handler';
import { ChoosingDateHandler } from './handlers/choosing-date.handler';
import { ChoosingTimeHandler } from './handlers/choosing-time.handler';
import { ConfirmingHandler } from './handlers/confirming.handler';
import { MyAppointmentsHandler } from './handlers/my-appointments.handler';
import { CancellingHandler } from './handlers/cancelling.handler';
import { IncomingMessageProcessor, BOT_SERVICE_TOKEN } from '../queue/processors/incoming-message.processor';
import { CustomerModule } from '../customer/customer.module';
import { ConversationModule } from '../conversation/conversation.module';
import { TenantModule } from '../tenant/tenant.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { RemindersModule } from '../reminders/reminders.module';
import { QUEUES } from '../queue/queue.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.INCOMING_WHATSAPP }),
    CustomerModule,
    ConversationModule,
    TenantModule,
    WhatsAppModule,
    RemindersModule,
  ],
  providers: [
    BotService,
    { provide: BOT_SERVICE_TOKEN, useExisting: BotService },
    AvailabilityService,
    IdleHandler,
    ChoosingServiceHandler,
    ChoosingBarberHandler,
    ChoosingDateHandler,
    ChoosingTimeHandler,
    ConfirmingHandler,
    MyAppointmentsHandler,
    CancellingHandler,
    IncomingMessageProcessor,
  ],
  exports: [BotService],
})
export class BotModule {}
