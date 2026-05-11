import { Injectable } from '@nestjs/common';
import { WhatsAppSenderService } from '../../whatsapp/whatsapp-sender.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AvailabilityService } from '../availability.service';
import { MSG } from '../bot.messages';
import type { HandlerInput, ConversationStateData } from '../bot.types';

@Injectable()
export class MyAppointmentsHandler {
  constructor(
    private readonly sender: WhatsAppSenderService,
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
  ) {}

  // Always executes immediately on entering this state (no user reply needed)
  async handle(input: HandlerInput): Promise<ConversationStateData> {
    const appointments = await this.getUpcoming(input.tenantId, input.customerId);

    if (appointments.length === 0) {
      await this.sender.send(input.tenantId, input.conversationId, input.phoneNumberId, {
        type: 'text',
        to: input.customerPhone,
        text: MSG.NO_UPCOMING_APPOINTMENTS,
      });
      return { state: 'IDLE' };
    }

    const lines = appointments.map((a, i) => {
      const dateStr = this.availability.toLocalDateStr(new Date(a.scheduledAt), input.tenantTimezone);
      const dateFormatted = this.availability.formatDateLong(dateStr, input.tenantTimezone);
      const timeFormatted = this.availability.formatTime(new Date(a.scheduledAt), input.tenantTimezone);
      return `${i + 1}. *${a.serviceName}* con ${a.barberName}\n   📅 ${dateFormatted}, ${timeFormatted}`;
    });

    const body = `${MSG.MY_APPOINTMENTS_HEADER}\n\n${lines.join('\n\n')}\n\n${MSG.MY_APPOINTMENTS_FOOTER}`;

    await this.sender.send(input.tenantId, input.conversationId, input.phoneNumberId, {
      type: 'text',
      to: input.customerPhone,
      text: body,
    });

    return { state: 'IDLE' };
  }

  private async getUpcoming(tenantId: string, customerId: string) {
    const db = this.prisma.forTenant(tenantId);

    // @ts-expect-error
    const appointments = await db.appointment.findMany({
      where: {
        customerId,
        status: { in: ['REQUESTED', 'CONFIRMED', 'REMINDED'] },
        scheduledAt: { gte: new Date() },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 5,
      select: {
        id: true,
        scheduledAt: true,
        service: { select: { name: true } },
        barber: { select: { name: true } },
      },
    });

    return (appointments as Array<{
      id: string;
      scheduledAt: Date;
      service: { name: string };
      barber: { name: string };
    }>).map((a) => ({
      id: a.id,
      scheduledAt: a.scheduledAt,
      serviceName: a.service.name,
      barberName: a.barber.name,
    }));
  }
}
