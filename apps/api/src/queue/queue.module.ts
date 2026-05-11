import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from './queue.constants';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          url: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 500 },
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUES.INCOMING_WHATSAPP },
      { name: QUEUES.REMINDERS },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
