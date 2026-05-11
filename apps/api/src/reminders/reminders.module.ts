import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RemindersService } from './reminders.service';
import { RemindersProcessor } from './reminders.processor';
import { QUEUES } from '../queue/queue.constants';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.REMINDERS }),
    PrismaModule,
    WhatsAppModule,
  ],
  providers: [RemindersService, RemindersProcessor],
  exports: [RemindersService],
})
export class RemindersModule {}
