import { Injectable } from '@nestjs/common';
import { WhatsAppSenderService } from '../../whatsapp/whatsapp-sender.service';
import { ConversationService } from '../../conversation/conversation.service';
import { MSG } from '../bot.messages';
import type { HandlerInput, ConversationStateData } from '../bot.types';

// Keywords that trigger each intent (simple classifier — no LLM in main flow)
const RESERVAR_RE = /reserv|cita|agendar|turno|quiero|hora|servi/i;
const MIS_CITAS_RE = /mis citas|ver cita|consult|cuándo|cuando|próxim/i;
const CANCELAR_RE = /cancel/i;
const HUMANO_RE = /humano|persona|agente|asesor|ayuda|help|soport/i;

@Injectable()
export class IdleHandler {
  constructor(
    private readonly sender: WhatsAppSenderService,
    private readonly conversationService: ConversationService,
  ) {}

  async handle(input: HandlerInput): Promise<ConversationStateData> {
    const intent = this.classifyIntent(input);

    switch (intent) {
      case 'RESERVAR':
        return this.goChooseService(input);
      case 'MIS_CITAS':
        return { state: 'MY_APPOINTMENTS' };
      case 'CANCELAR':
        return { state: 'CANCELLING_SELECT' };
      case 'HUMANO':
        return this.escalate(input);
      default:
        await this.sendMainMenu(input);
        return { state: 'IDLE' };
    }
  }

  private classifyIntent(input: HandlerInput): string {
    // Button/list replies are always explicit
    if (input.interactiveId) return input.interactiveId;

    const text = input.textBody ?? '';

    if (RESERVAR_RE.test(text)) return 'RESERVAR';
    if (MIS_CITAS_RE.test(text)) return 'MIS_CITAS';
    if (CANCELAR_RE.test(text)) return 'CANCELAR';
    if (HUMANO_RE.test(text)) return 'HUMANO';

    return 'UNKNOWN';
  }

  private async goChooseService(input: HandlerInput): Promise<ConversationStateData> {
    return { state: 'CHOOSING_SERVICE', booking: {} };
  }

  async sendMainMenu(input: HandlerInput, isRepeat = false): Promise<void> {
    const body = isRepeat
      ? MSG.UNKNOWN_INPUT
      : MSG.GREETING(input.customerName ?? '');

    await this.sender.send(
      input.tenantId,
      input.conversationId,
      input.phoneNumberId,
      {
        type: 'interactive_list',
        to: input.customerPhone,
        body,
        buttonText: MSG.MAIN_MENU_BUTTON,
        sections: [{ rows: [...MSG.MAIN_MENU_OPTIONS] }],
      },
    );
  }

  private async escalate(input: HandlerInput): Promise<ConversationStateData> {
    await this.sender.send(
      input.tenantId,
      input.conversationId,
      input.phoneNumberId,
      {
        type: 'text',
        to: input.customerPhone,
        text: MSG.ESCALATION_CLIENT,
      },
    );

    await this.conversationService.markEscalated(input.tenantId, input.conversationId);

    // Notify tenant admin(s)
    // Phase 4 will expose which admin number to notify. For now, stored as a no-op hook.
    // await this.notifyAdminEscalation(input);

    // Return IDLE — conversation status is ESCALATED in DB (bot stops responding)
    return { state: 'IDLE' };
  }
}
