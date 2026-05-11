import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUES } from '../queue/queue.constants';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.REMINDERS) private readonly remindersQueue: Queue,
  ) {}

  async scheduleRemindersForAppointment(appointmentId: string, tenantId: string) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        customer: { select: { whatsappPhone: true, name: true } },
        barber: { select: { name: true } },
        service: { select: { name: true } },
        tenant: { select: { whatsappPhoneNumberId: true, timezone: true } },
      },
    });

    if (!appt || appt.status !== 'CONFIRMED') return;

    const scheduledAt = appt.scheduledAt.getTime();
    const now = Date.now();

    const delays: Record<string, number> = {
      '24h': scheduledAt - now - 24 * 60 * 60 * 1000,
      '2h': scheduledAt - now - 2 * 60 * 60 * 1000,
    };

    for (const [label, delay] of Object.entries(delays)) {
      if (delay > 0) {
        await this.remindersQueue.add(
          'send-reminder',
          {
            appointmentId,
            tenantId,
            reminderType: label,
            customerPhone: appt.customer.whatsappPhone,
            customerName: appt.customer.name,
            barberName: appt.barber.name,
            serviceName: appt.service.name,
            scheduledAt: appt.scheduledAt.toISOString(),
            phoneNumberId: appt.tenant.whatsappPhoneNumberId,
          },
          {
            delay,
            jobId: `reminder-${appointmentId}-${label}`,
            removeOnComplete: true,
            removeOnFail: false,
          },
        );
        this.logger.log(`Scheduled ${label} reminder for appointment ${appointmentId}`);
      }
    }
  }

  async cancelRemindersForAppointment(appointmentId: string) {
    for (const label of ['24h', '2h']) {
      const job = await this.remindersQueue.getJob(`reminder-${appointmentId}-${label}`);
      if (job) {
        await job.remove();
        this.logger.log(`Cancelled ${label} reminder for appointment ${appointmentId}`);
      }
    }
  }

  async scheduleDailySummary(tenantId: string) {
    await this.remindersQueue.add(
      'daily-barber-summary',
      { tenantId },
      {
        repeat: { pattern: '0 7 * * *', tz: 'America/Mexico_City' },
        jobId: `daily-summary-${tenantId}`,
      },
    );
  }
}
