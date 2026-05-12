import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppSenderService } from '../../whatsapp/whatsapp-sender.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AvailabilityService } from '../availability.service';
import { RemindersService } from '../../reminders/reminders.service';
import { MSG } from '../bot.messages';
import type { HandlerInput, ConversationStateData } from '../bot.types';

@Injectable()
export class ConfirmingHandler {
  private readonly logger = new Logger(ConfirmingHandler.name);

  constructor(
    private readonly sender: WhatsAppSenderService,
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly reminders: RemindersService,
  ) {}

  async onEnter(input: HandlerInput): Promise<void> {
    const booking = input.currentState.booking!;
    const scheduledAt = new Date(booking.scheduledAt!);

    const dateFormatted = this.availability.formatDateLong(booking.date!, input.tenantTimezone);
    const timeFormatted = this.availability.formatTime(scheduledAt, input.tenantTimezone);
    const priceFormatted = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: booking.currency === 'USD' ? 'USD' : 'MXN',
    }).format(booking.priceLocal!);

    await this.sender.send(input.tenantId, input.conversationId, input.phoneNumberId, {
      type: 'interactive_buttons',
      to: input.customerPhone,
      body: MSG.CONFIRM_SUMMARY({
        serviceName: booking.serviceName!,
        barberName: booking.barberName!,
        dateFormatted,
        timeFormatted,
        price: priceFormatted,
      }),
      buttons: [...MSG.CONFIRM_BUTTONS],
    });
  }

  async handle(input: HandlerInput): Promise<ConversationStateData> {
    const id = input.interactiveId;

    if (id === 'CANCELAR_FLUJO') {
      await this.sender.send(input.tenantId, input.conversationId, input.phoneNumberId, {
        type: 'text',
        to: input.customerPhone,
        text: MSG.FLOW_CANCELLED,
      });
      return { state: 'IDLE' };
    }

    if (id !== 'CONFIRMAR') {
      // Resend confirmation if unexpected input
      await this.onEnter(input);
      return input.currentState;
    }

    return this.createAppointment(input);
  }

  private async createAppointment(input: HandlerInput): Promise<ConversationStateData> {
    const booking = input.currentState.booking!;
    const db = this.prisma.forTenant(input.tenantId);

    try {
      // @ts-ignore
      const appointment = await db.appointment.create({
        data: {
          tenantId: input.tenantId,
          customerId: input.customerId,
          barberId: booking.barberId!,
          serviceId: booking.serviceId!,
          scheduledAt: new Date(booking.scheduledAt!),
          durationMin: booking.durationMin!,
          status: 'CONFIRMED',
          priceCharged: booking.priceLocal,
          createdVia: 'WHATSAPP',
        },
        select: { id: true },
      });

      this.logger.log(
        { tenantId: input.tenantId, appointmentId: appointment.id },
        'Appointment created',
      );

      const scheduledAt = new Date(booking.scheduledAt!);
      const dateFormatted = this.availability.formatDateLong(booking.date!, input.tenantTimezone);
      const timeFormatted = this.availability.formatTime(scheduledAt, input.tenantTimezone);

      await this.sender.send(input.tenantId, input.conversationId, input.phoneNumberId, {
        type: 'text',
        to: input.customerPhone,
        text: MSG.CONFIRMED(booking.barberName!, dateFormatted, timeFormatted),
      });

      this.reminders.scheduleRemindersForAppointment(appointment.id, input.tenantId).catch(
        (err: unknown) => this.logger.error({ err }, 'Failed to schedule reminders'),
      );

    } catch (err) {
      this.logger.error({ err, booking }, 'Failed to create appointment');
      await this.sender.send(input.tenantId, input.conversationId, input.phoneNumberId, {
        type: 'text',
        to: input.customerPhone,
        text: MSG.ERROR_GENERIC,
      });
    }

    return { state: 'IDLE' };
  }
}
