import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppSenderService } from '../../whatsapp/whatsapp-sender.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AvailabilityService } from '../availability.service';
import { MSG } from '../bot.messages';
import type { HandlerInput, ConversationStateData } from '../bot.types';

@Injectable()
export class CancellingHandler {
  private readonly logger = new Logger(CancellingHandler.name);

  constructor(
    private readonly sender: WhatsAppSenderService,
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
  ) {}

  // State: CANCELLING_SELECT — show list of cancellable appointments
  async handleSelect(input: HandlerInput): Promise<ConversationStateData> {
    const appointments = await this.getCancellable(input.tenantId, input.customerId);

    if (appointments.length === 0) {
      await this.sender.send(input.tenantId, input.conversationId, input.phoneNumberId, {
        type: 'text',
        to: input.customerPhone,
        text: MSG.NO_APPOINTMENTS_TO_CANCEL,
      });
      return { state: 'IDLE' };
    }

    if (appointments.length === 1) {
      // Skip selection step — confirm directly
      const a = appointments[0]!;
      return this.buildConfirmState(input, a);
    }

    await this.sender.send(input.tenantId, input.conversationId, input.phoneNumberId, {
      type: 'interactive_list',
      to: input.customerPhone,
      body: MSG.CANCEL_SELECT_TITLE,
      buttonText: MSG.CANCEL_SELECT_BUTTON,
      sections: [
        {
          rows: appointments.map((a) => {
            const dateStr = this.availability.toLocalDateStr(
              new Date(a.scheduledAt),
              input.tenantTimezone,
            );
            const dateFormatted = this.availability.formatDateLong(dateStr, input.tenantTimezone);
            const timeFormatted = this.availability.formatTime(
              new Date(a.scheduledAt),
              input.tenantTimezone,
            );
            return {
              id: a.id,
              title: a.serviceName,
              description: `${dateFormatted}, ${timeFormatted}`,
            };
          }),
        },
      ],
    });

    return { ...input.currentState, state: 'CANCELLING_SELECT' };
  }

  // State: CANCELLING_SELECT (waiting for user to pick which appointment)
  async handleSelectReply(input: HandlerInput): Promise<ConversationStateData> {
    const appointmentId = input.interactiveId;

    if (!appointmentId) {
      return this.handleSelect(input);
    }

    const appointment = await this.getAppointment(input.tenantId, appointmentId);
    if (!appointment) {
      return this.handleSelect(input);
    }

    return this.buildConfirmState(input, appointment);
  }

  private async buildConfirmState(
    input: HandlerInput,
    appointment: { id: string; scheduledAt: Date; serviceName: string; barberName: string },
  ): Promise<ConversationStateData> {
    const dateStr = this.availability.toLocalDateStr(
      new Date(appointment.scheduledAt),
      input.tenantTimezone,
    );
    const dateFormatted = this.availability.formatDateLong(dateStr, input.tenantTimezone);
    const timeFormatted = this.availability.formatTime(
      new Date(appointment.scheduledAt),
      input.tenantTimezone,
    );

    await this.sender.send(input.tenantId, input.conversationId, input.phoneNumberId, {
      type: 'interactive_buttons',
      to: input.customerPhone,
      body: MSG.CANCEL_CONFIRM(appointment.serviceName, dateFormatted, timeFormatted),
      buttons: [...MSG.CANCEL_CONFIRM_BUTTONS],
    });

    return { state: 'CANCELLING_CONFIRM', cancelTargetId: appointment.id };
  }

  // State: CANCELLING_CONFIRM — user replies to confirm or abort
  async handleConfirmReply(input: HandlerInput): Promise<ConversationStateData> {
    const id = input.interactiveId;

    if (id === 'NO_CANCELAR') {
      await this.sender.send(input.tenantId, input.conversationId, input.phoneNumberId, {
        type: 'text',
        to: input.customerPhone,
        text: MSG.CANCEL_ABORTED,
      });
      return { state: 'IDLE' };
    }

    if (id !== 'CONFIRMAR_CANCELAR') {
      await this.handleSelect({ ...input, currentState: { state: 'CANCELLING_SELECT' } });
      return { state: 'CANCELLING_SELECT' };
    }

    const targetId = input.currentState.cancelTargetId;
    if (!targetId) return { state: 'IDLE' };

    const db = this.prisma.forTenant(input.tenantId);
    try {
      // @ts-ignore
      await db.appointment.update({
        where: { id: targetId },
        data: { status: 'CANCELLED' },
      });

      this.logger.log({ tenantId: input.tenantId, appointmentId: targetId }, 'Appointment cancelled');

      await this.sender.send(input.tenantId, input.conversationId, input.phoneNumberId, {
        type: 'text',
        to: input.customerPhone,
        text: MSG.CANCEL_SUCCESS,
      });
    } catch (err) {
      this.logger.error({ err }, 'Failed to cancel appointment');
      await this.sender.send(input.tenantId, input.conversationId, input.phoneNumberId, {
        type: 'text',
        to: input.customerPhone,
        text: MSG.ERROR_GENERIC,
      });
    }

    return { state: 'IDLE' };
  }

  private async getCancellable(tenantId: string, customerId: string) {
    const db = this.prisma.forTenant(tenantId);
    // @ts-ignore
    const rows = await db.appointment.findMany({
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

    return (rows as Array<{ id: string; scheduledAt: Date; service: { name: string }; barber: { name: string } }>)
      .map((r) => ({
        id: r.id,
        scheduledAt: r.scheduledAt,
        serviceName: r.service.name,
        barberName: r.barber.name,
      }));
  }

  private async getAppointment(tenantId: string, appointmentId: string) {
    const db = this.prisma.forTenant(tenantId);
    // @ts-ignore
    const row = await db.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        scheduledAt: true,
        service: { select: { name: true } },
        barber: { select: { name: true } },
      },
    });

    if (!row) return null;
    return {
      id: (row as { id: string }).id,
      scheduledAt: (row as { scheduledAt: Date }).scheduledAt,
      serviceName: (row as { service: { name: string } }).service.name,
      barberName: (row as { barber: { name: string } }).barber.name,
    };
  }
}
