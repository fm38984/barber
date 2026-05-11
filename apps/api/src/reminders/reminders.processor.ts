import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '../queue/queue.constants';
import { WhatsAppSenderService } from '../whatsapp/whatsapp-sender.service';
import { PrismaService } from '../prisma/prisma.service';
import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';

interface ReminderJobData {
  appointmentId: string;
  tenantId: string;
  reminderType: '24h' | '2h';
  customerPhone: string;
  customerName: string | null;
  barberName: string;
  serviceName: string;
  scheduledAt: string;
  phoneNumberId: string;
}

interface DailySummaryJobData {
  tenantId: string;
}

@Processor(QUEUES.REMINDERS)
export class RemindersProcessor extends WorkerHost {
  private readonly logger = new Logger(RemindersProcessor.name);

  constructor(
    private readonly sender: WhatsAppSenderService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'send-reminder') {
      await this.sendReminder(job.data as ReminderJobData);
    } else if (job.name === 'daily-barber-summary') {
      await this.sendDailySummary(job.data as DailySummaryJobData);
    }
  }

  private async sendReminder(data: ReminderJobData) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: data.tenantId },
      select: { timezone: true },
    });

    const tz = tenant?.timezone ?? 'America/Mexico_City';
    const scheduledAt = new Date(data.scheduledAt);
    const timeStr = formatInTimeZone(scheduledAt, tz, "EEEE d 'de' MMMM 'a las' h:mm a", { locale: es });
    const horasTexto = data.reminderType === '24h' ? 'mañana' : 'en 2 horas';
    const nombre = data.customerName ?? 'Cliente';

    const body = `Hola ${nombre} 👋, te recordamos tu cita ${horasTexto}:\n\n📅 *${timeStr}*\n✂️ Servicio: ${data.serviceName}\n💈 Barbero: ${data.barberName}\n\nSi necesitas cancelar, contáctanos. ¡Te esperamos!`;

    await this.sender.send(data.tenantId, '', data.phoneNumberId, {
      type: 'text',
      to: data.customerPhone.replace('+', ''),
      body,
    });

    this.logger.log(`Sent ${data.reminderType} reminder for appointment ${data.appointmentId}`);
  }

  private async sendDailySummary(data: DailySummaryJobData) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        tenantId: data.tenantId,
        scheduledAt: { gte: today, lt: tomorrow },
        status: 'CONFIRMED',
      },
      include: {
        customer: { select: { name: true, whatsappPhone: true } },
        service: { select: { name: true, durationMin: true } },
        barber: { select: { name: true, id: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: data.tenantId },
      select: { timezone: true, whatsappPhoneNumberId: true },
    });

    if (!tenant || appointments.length === 0) return;

    const byBarber = new Map<string, { name: string; appts: typeof appointments }>();
    for (const appt of appointments) {
      const key = appt.barber.id;
      if (!byBarber.has(key)) byBarber.set(key, { name: appt.barber.name, appts: [] });
      byBarber.get(key)!.appts.push(appt);
    }

    this.logger.log(`Daily summary: ${appointments.length} appointments for tenant ${data.tenantId}`);
  }
}
