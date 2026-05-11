import { Injectable } from '@nestjs/common';
import { WhatsAppSenderService } from '../../whatsapp/whatsapp-sender.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MSG } from '../bot.messages';
import type { HandlerInput, ConversationStateData } from '../bot.types';

@Injectable()
export class ChoosingBarberHandler {
  constructor(
    private readonly sender: WhatsAppSenderService,
    private readonly prisma: PrismaService,
  ) {}

  async onEnter(input: HandlerInput): Promise<void> {
    const barbers = await this.getActiveBarbers(input.tenantId);

    await this.sender.send(input.tenantId, input.conversationId, input.phoneNumberId, {
      type: 'interactive_list',
      to: input.customerPhone,
      body: MSG.CHOOSE_BARBER,
      buttonText: MSG.CHOOSE_BARBER_BUTTON,
      sections: [
        {
          rows: [
            MSG.ANY_BARBER,
            ...barbers.map((b) => ({ id: b.id, title: b.name })),
          ],
        },
      ],
    });
  }

  async handle(input: HandlerInput): Promise<ConversationStateData> {
    const barberId = input.interactiveId;

    if (!barberId) {
      await this.onEnter(input);
      return input.currentState;
    }

    // "ANY" means the user wants whoever is available first
    if (barberId === 'ANY') {
      return {
        state: 'CHOOSING_DATE',
        booking: {
          ...input.currentState.booking,
          barberId: null,
          barberName: 'cualquier barbero',
        },
      };
    }

    const barber = await this.getBarber(input.tenantId, barberId);

    if (!barber) {
      await this.onEnter(input);
      return input.currentState;
    }

    return {
      state: 'CHOOSING_DATE',
      booking: {
        ...input.currentState.booking,
        barberId: barber.id,
        barberName: barber.name,
      },
    };
  }

  private async getActiveBarbers(tenantId: string) {
    const db = this.prisma.forTenant(tenantId);
    // @ts-expect-error
    return db.barber.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }) as Promise<Array<{ id: string; name: string }>>;
  }

  private async getBarber(tenantId: string, barberId: string) {
    const db = this.prisma.forTenant(tenantId);
    // @ts-expect-error
    return db.barber.findUnique({
      where: { id: barberId },
      select: { id: true, name: true },
    });
  }
}
