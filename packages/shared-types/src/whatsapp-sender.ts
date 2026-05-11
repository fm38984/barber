// Types for outgoing WhatsApp messages via Meta Cloud API

export interface SendTextMessage {
  type: 'text';
  to: string;
  text: string;
  previewUrl?: boolean;
}

export interface WhatsAppButton {
  id: string;
  title: string; // max 20 chars
}

export interface SendInteractiveButtonsMessage {
  type: 'interactive_buttons';
  to: string;
  body: string;         // max 1024 chars
  buttons: WhatsAppButton[]; // max 3
  header?: string;
  footer?: string;
}

export interface WhatsAppListRow {
  id: string;
  title: string;       // max 24 chars
  description?: string; // max 72 chars
}

export interface WhatsAppListSection {
  title?: string;
  rows: WhatsAppListRow[]; // max 10 rows total across all sections
}

export interface SendInteractiveListMessage {
  type: 'interactive_list';
  to: string;
  body: string;
  buttonText: string;   // text on the list button, max 20 chars
  sections: WhatsAppListSection[];
  header?: string;
  footer?: string;
}

export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters?: Array<{
    type: 'text' | 'currency' | 'date_time';
    text?: string;
  }>;
  index?: number;
  sub_type?: string;
}

export interface SendTemplateMessage {
  type: 'template';
  to: string;
  templateName: string;
  languageCode: string;
  components?: WhatsAppTemplateComponent[];
}

export type OutgoingMessage =
  | SendTextMessage
  | SendInteractiveButtonsMessage
  | SendInteractiveListMessage
  | SendTemplateMessage;

export interface MetaSendResponse {
  messaging_product: 'whatsapp';
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}
