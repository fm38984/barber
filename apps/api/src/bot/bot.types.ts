export type BotState =
  | 'IDLE'
  | 'CHOOSING_SERVICE'
  | 'CHOOSING_BARBER'
  | 'CHOOSING_DATE'
  | 'CHOOSING_TIME'
  | 'CONFIRMING'
  | 'MY_APPOINTMENTS'
  | 'CANCELLING_SELECT'   // user is selecting which appointment to cancel
  | 'CANCELLING_CONFIRM'; // user is confirming the cancellation

export interface BookingDraft {
  serviceId?: string;
  serviceName?: string;
  durationMin?: number;
  priceLocal?: number;
  currency?: string;
  barberId?: string | null; // null = "cualquier barbero disponible"
  barberName?: string;
  date?: string;            // YYYY-MM-DD in tenant local timezone
  scheduledAt?: string;     // ISO 8601 UTC — final confirmed datetime
}

export interface ConversationStateData {
  state: BotState;
  booking?: BookingDraft;
  cancelTargetId?: string; // appointment ID pending cancellation confirmation
}

// Context passed to every state handler
export interface HandlerInput {
  tenantId: string;
  tenantName: string;
  tenantTimezone: string;
  phoneNumberId: string;  // WhatsApp phone number that will send replies
  conversationId: string;
  customerId: string;
  customerPhone: string;  // destination of replies
  customerName: string | null;
  textBody?: string;
  interactiveId?: string;    // button_reply.id or list_reply.id
  interactiveTitle?: string; // button_reply.title or list_reply.title
  currentState: ConversationStateData;
}
