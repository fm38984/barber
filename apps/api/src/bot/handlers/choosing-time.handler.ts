import { Injectable } from '@nestjs/common';
import { WhatsAppSenderService } from '../../whatsapp/whatsapp-sender.service';
import { AvailabilityService } from '../availability.service';
import { MSG } from '../bot.messages';
import type { HandlerInput, ConversationStateData } from '../bot.types';

@Injectable()
export class ChoosingTimeHandler {
  constructor(
    private readonly sender: WhatsAppSenderService,
    private readonly availability: AvailabilityService,
  ) {}

  async onEnter(input: HandlerInput): Promise<void> {
    const booking = input.currentState.booking!;

    const { slots } = await this.availability.getAvailableSlots(
      input.tenantId,
      booking.barberId ?? null,
      booking.durationMin!,
      booking.date!,
      input.tenantTimezone,
    );

    const dateFormatted = this.availability.formatDateLong(booking.date!, input.tenantTimezone);

    if (slots.length === 0) {
      await this.sender.send(input.tenantId, input.conversationId, input.phoneNumberId, {
        type: 'interactive_buttons',
        to: input.customerPhone,
        body: MSG.NO_AVAILABILITY_TIME,
        buttons: MSG.NO_AVAILABILITY_TIME_BUTTONS,
      });
      return;
    }

    await this.sender.send(input.tenantId, input.conversationId, input.phoneNumberId, {
      type: 'interactive_list',
      to: input.customerPhone,
      body: MSG.CHOOSE_TIME(dateFormatted),
      buttonText: MSG.CHOOSE_TIME_BUTTON,
      sections: [
        {
          rows: slots.map((s) => ({ id: s.id, title: s.label })),
        },
      ],
    });
  }

  async handle(input: HandlerInput): Promise<ConversationStateData> {
    const slotId = input.interactiveId;

    // Handle "no availability" buttons
    if (slotId === 'CAMBIAR_FECHA') {
      return {
        state: 'CHOOSING_DATE',
        booking: { ...input.currentState.booking, date: undefined },
      };
    }

    if (slotId === 'CANCELAR_FLUJO') {
      return { state: 'IDLE' };
    }

    // slotId is an ISO string (e.g., "2024-01-15T16:00:00.000Z")
    if (!slotId || !Date.parse(slotId)) {
      await this.onEnter(input);
      return input.currentState;
    }

    const scheduledAt = new Date(slotId);
    const booking = input.currentState.booking!;

    // Resolve final barberId when user picked "cualquier barbero"
    let finalBarberId = booking.barberId ?? null;
    let finalBarberName = booking.barberName ?? 'barbero asignado';

    if (finalBarberId === null) {
      const { resolvedBarberId } = await this.availability.getAvailableSlots(
        input.tenantId,
        null,
        booking.durationMin!,
        booking.date!,
        input.tenantTimezone,
      );
      finalBarberId = resolvedBarberId;
    }

    return {
      state: 'CONFIRMING',
      booking: {
        ...booking,
        barberId: finalBarberId,
        barberName: finalBarberName,
        scheduledAt: scheduledAt.toISOString(),
      },
    };
  }
}
