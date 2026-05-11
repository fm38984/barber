import { Injectable, Logger } from '@nestjs/common';
import { ConversationService } from '../conversation/conversation.service';
import { IdleHandler } from './handlers/idle.handler';
import { ChoosingServiceHandler } from './handlers/choosing-service.handler';
import { ChoosingBarberHandler } from './handlers/choosing-barber.handler';
import { ChoosingDateHandler } from './handlers/choosing-date.handler';
import { ChoosingTimeHandler } from './handlers/choosing-time.handler';
import { ConfirmingHandler } from './handlers/confirming.handler';
import { MyAppointmentsHandler } from './handlers/my-appointments.handler';
import { CancellingHandler } from './handlers/cancelling.handler';
import type { ConversationStateData, HandlerInput } from './bot.types';
import type { Conversation, Customer } from '@barberflow/db';
import type { IncomingMessageJobData } from '../queue/queue.types';

interface BotEntryParams {
  tenant: { id: string; name: string; timezone: string; whatsappPhoneNumberId: string };
  conversation: Conversation;
  customer: Customer;
  job: IncomingMessageJobData;
}

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly idle: IdleHandler,
    private readonly choosingService: ChoosingServiceHandler,
    private readonly choosingBarber: ChoosingBarberHandler,
    private readonly choosingDate: ChoosingDateHandler,
    private readonly choosingTime: ChoosingTimeHandler,
    private readonly confirming: ConfirmingHandler,
    private readonly myAppointments: MyAppointmentsHandler,
    private readonly cancelling: CancellingHandler,
  ) {}

  async handleIncoming(params: BotEntryParams): Promise<void> {
    const { tenant, conversation, customer, job } = params;

    // Escalated conversations: bot does not respond until admin releases
    if ((conversation.status as string) === 'ESCALATED') {
      this.logger.debug(
        { conversationId: conversation.id },
        'Conversation is escalated — bot silent',
      );
      return;
    }

    const currentState = (conversation.stateJson ?? { state: 'IDLE' }) as ConversationStateData;

    const input: HandlerInput = {
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantTimezone: tenant.timezone,
      phoneNumberId: tenant.whatsappPhoneNumberId,
      conversationId: conversation.id,
      customerId: customer.id,
      customerPhone: `+${job.from}`,
      customerName: customer.name ?? null,
      textBody: job.textBody,
      interactiveId: job.interactiveReply?.button_reply?.id ?? job.interactiveReply?.list_reply?.id,
      interactiveTitle:
        job.interactiveReply?.button_reply?.title ?? job.interactiveReply?.list_reply?.title,
      currentState,
    };

    let nextState: ConversationStateData;

    try {
      nextState = await this.dispatch(input, currentState.state);
    } catch (err) {
      this.logger.error({ err, conversationId: conversation.id, state: currentState.state }, 'Bot handler error');
      nextState = { state: 'IDLE' };
    }

    // Persist new state
    await this.conversationService.updateState(tenant.id, conversation.id, nextState);

    // If state changed, trigger onEnter for the new state
    if (nextState.state !== currentState.state) {
      await this.triggerOnEnter(
        { ...input, currentState: nextState },
        nextState.state,
      );
    }
  }

  private async dispatch(
    input: HandlerInput,
    state: string,
  ): Promise<ConversationStateData> {
    switch (state) {
      case 'IDLE':
        return this.idle.handle(input);

      case 'CHOOSING_SERVICE':
        return this.choosingService.handle(input);

      case 'CHOOSING_BARBER':
        return this.choosingBarber.handle(input);

      case 'CHOOSING_DATE':
        return this.choosingDate.handle(input);

      case 'CHOOSING_TIME':
        return this.choosingTime.handle(input);

      case 'CONFIRMING':
        return this.confirming.handle(input);

      case 'MY_APPOINTMENTS':
        // This state processes immediately (no waiting for user input)
        return this.myAppointments.handle(input);

      case 'CANCELLING_SELECT':
        return this.cancelling.handleSelectReply(input);

      case 'CANCELLING_CONFIRM':
        return this.cancelling.handleConfirmReply(input);

      default:
        this.logger.warn({ state }, 'Unknown state — resetting to IDLE');
        return { state: 'IDLE' };
    }
  }

  private async triggerOnEnter(
    input: HandlerInput,
    newState: string,
  ): Promise<void> {
    switch (newState) {
      case 'IDLE':
        // Don't send greeting on every return to IDLE
        break;

      case 'CHOOSING_SERVICE':
        await this.choosingService.onEnter(input);
        break;

      case 'CHOOSING_BARBER':
        await this.choosingBarber.onEnter(input);
        break;

      case 'CHOOSING_DATE':
        await this.choosingDate.onEnter(input);
        break;

      case 'CHOOSING_TIME':
        await this.choosingTime.onEnter(input);
        break;

      case 'CONFIRMING':
        await this.confirming.onEnter(input);
        break;

      case 'MY_APPOINTMENTS':
        // Already handled in dispatch (no reply needed before executing)
        break;

      case 'CANCELLING_SELECT':
        await this.cancelling.handleSelect(input);
        break;

      default:
        break;
    }
  }
}
