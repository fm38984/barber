import type { WhatsAppMessageType, WhatsAppInteractiveReply } from '@barberflow/shared-types';

// Job payload enqueued when Meta sends an incoming message webhook
export interface IncomingMessageJobData {
  phoneNumberId: string;   // identifies which tenant received this message
  from: string;            // sender's WhatsApp number (e.g. "5215551234567")
  contactName: string | null;
  messageId: string;       // WhatsApp message ID (wamid.xxx)
  timestamp: string;       // unix timestamp string from Meta
  messageType: WhatsAppMessageType;
  textBody?: string;
  interactiveReply?: WhatsAppInteractiveReply;
}
