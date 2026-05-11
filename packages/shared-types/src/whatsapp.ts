// WhatsApp Business Cloud API webhook payload types
// Based on Meta's official documentation v20.0

export interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account';
  entry: WhatsAppEntry[];
}

export interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

export interface WhatsAppChange {
  value: WhatsAppChangeValue;
  field: 'messages';
}

export interface WhatsAppChangeValue {
  messaging_product: 'whatsapp';
  metadata: WhatsAppMetadata;
  contacts?: WhatsAppContact[];
  messages?: WhatsAppIncomingMessage[];
  statuses?: WhatsAppMessageStatus[];
  errors?: WhatsAppError[];
}

export interface WhatsAppMetadata {
  display_phone_number: string;
  phone_number_id: string;
}

export interface WhatsAppContact {
  profile: { name: string };
  wa_id: string;
}

export type WhatsAppMessageType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'location'
  | 'interactive'
  | 'button'
  | 'order'
  | 'system'
  | 'unknown';

export interface WhatsAppIncomingMessage {
  from: string;
  id: string;
  timestamp: string;
  type: WhatsAppMessageType;
  text?: { body: string };
  interactive?: WhatsAppInteractiveReply;
  button?: { payload: string; text: string };
  context?: { from: string; id: string };
}

export interface WhatsAppInteractiveReply {
  type: 'button_reply' | 'list_reply';
  button_reply?: { id: string; title: string };
  list_reply?: { id: string; title: string; description?: string };
}

export interface WhatsAppMessageStatus {
  id: string;
  recipient_id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  errors?: WhatsAppError[];
}

export interface WhatsAppError {
  code: number;
  title: string;
  message?: string;
  error_data?: { details: string };
}
