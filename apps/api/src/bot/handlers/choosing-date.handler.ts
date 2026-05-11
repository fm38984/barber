import { Injectable } from '@nestjs/common';
import { WhatsAppSenderService } from '../../whatsapp/whatsapp-sender.service';
import { AvailabilityService } from '../availability.service';
import { MSG } from '../bot.messages';
import type { HandlerInput, ConversationStateData } from '../bot.types';

@Injectable()
export class ChoosingDateHandler {
  constructor(
    private readonly sender: WhatsAppSenderService,
    private readonly availability: AvailabilityService,
  ) {}

  async onEnter(input: HandlerInput): Promise<void> {
    const booking = input.currentState.booking!;

    const days = await this.availability.getAvailableDays(
      input.tenantId,
      booking.barberId ?? null,
      booking.durationMin!,
      input.tenantTimezone,
    );

    if (days.length === 0) {
      await this.sender.send(input.tenantId, input.conversationId, input.phoneNumberId, {
        type: 'text',
        to: input.customerPhone,
        text: MSG.NO_AVAILABILITY_DATE,
      });
      return;
    }

    await this.sender.send(input.tenantId, input.conversationId, input.phoneNumberId, {
      type: 'interactive_list',
      to: input.customerPhone,
      body: MSG.CHOOSE_DATE,
      buttonText: MSG.CHOOSE_DATE_BUTTON,
      sections: [
        {
          rows: days.map((d) => ({
            id: d.date,
            title: d.dateFormatted,
          })),
        },
      ],
    });
  }

  async handle(input: HandlerInput): Promise<ConversationStateData> {
    const dateId = input.interactiveId; // "YYYY-MM-DD"

    if (!dateId || !dateId.match(/^\d{4}-\d{2}-\d{2}$/)) {
      await this.onEnter(input);
      return input.currentState;
    }

    return {
      state: 'CHOOSING_TIME',
      booking: {
        ...input.currentState.booking,
        date: dateId,
      },
    };
  }
}
