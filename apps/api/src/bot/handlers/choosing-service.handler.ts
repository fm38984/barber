import { Injectable } from '@nestjs/common';
import { WhatsAppSenderService } from '../../whatsapp/whatsapp-sender.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MSG } from '../bot.messages';
import type { HandlerInput, ConversationStateData } from '../bot.types';

@Injectable()
export class ChoosingServiceHandler {
  constructor(
    private readonly sender: WhatsAppSenderService,
    private readonly prisma: PrismaService,
  ) {}

  // Called on first entry to this state (sends the services list)
  async onEnter(input: HandlerInput): Promise<void> {
    const services = await this.getActiveServices(input.tenantId);

    if (services.length === 0) {
      await this.sender.send(input.tenantId, input.conversationId, input.phoneNumberId, {
        type: 'text',
        to: input.customerPhone,
        text: 'Lo sentimos, no hay servicios disponibles en este momento.',
      });
      return;
    }

    await this.sender.send(input.tenantId, input.conversationId, input.phoneNumberId, {
      type: 'interactive_list',
      to: input.customerPhone,
      body: MSG.CHOOSE_SERVICE,
      buttonText: MSG.CHOOSE_SERVICE_BUTTON,
      sections: [
        {
          rows: services.map((s) => ({
            id: s.id,
            title: s.name,
            description: `${s.durationMin} min — ${this.formatPrice(s.priceLocal, s.currency)}`,
          })),
        },
      ],
    });
  }

  // Called when user replies with a service selection
  async handle(input: HandlerInput): Promise<ConversationStateData> {
    const serviceId = input.interactiveId;

    if (!serviceId) {
      // Non-interactive reply while in this state → resend list
      await this.onEnter(input);
      return input.currentState;
    }

    const service = await this.getService(input.tenantId, serviceId);

    if (!service) {
      await this.onEnter(input);
      return input.currentState;
    }

    return {
      state: 'CHOOSING_BARBER',
      booking: {
        ...input.currentState.booking,
        serviceId: service.id,
        serviceName: service.name,
        durationMin: service.durationMin,
        priceLocal: Number(service.priceLocal),
        currency: service.currency,
      },
    };
  }

  private async getActiveServices(tenantId: string) {
    const db = this.prisma.forTenant(tenantId);
    // @ts-ignore
    return db.service.findMany({
      where: { isActive: true },
      select: { id: true, name: true, durationMin: true, priceLocal: true, currency: true },
      orderBy: { name: 'asc' },
    }) as Promise<Array<{ id: string; name: string; durationMin: number; priceLocal: unknown; currency: string }>>;
  }

  private async getService(tenantId: string, serviceId: string) {
    const db = this.prisma.forTenant(tenantId);
    // @ts-ignore
    return db.service.findUnique({
      where: { id: serviceId },
      select: { id: true, name: true, durationMin: true, priceLocal: true, currency: true },
    });
  }

  private formatPrice(price: unknown, currency: string): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency === 'USD' ? 'USD' : 'MXN',
      minimumFractionDigits: 2,
    }).format(Number(price));
  }
}
