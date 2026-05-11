/**
 * Real-world WhatsApp webhook payload examples from Meta's documentation.
 * Used across multiple test files.
 */

import type { WhatsAppWebhookPayload } from '@barberflow/shared-types';

export const PHONE_NUMBER_ID = 'phone-id-aaa'; // maps to test tenant A

// Incoming text message
export const textMessagePayload: WhatsAppWebhookPayload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '102290129340398',
      changes: [
        {
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '15550001111',
              phone_number_id: PHONE_NUMBER_ID,
            },
            contacts: [
              {
                profile: { name: 'Juan Pérez' },
                wa_id: '5215551234567',
              },
            ],
            messages: [
              {
                from: '5215551234567',
                id: 'wamid.test_text_001',
                timestamp: '1704067200', // 2024-01-01 00:00:00 UTC
                type: 'text',
                text: { body: 'Hola, quiero hacer una cita' },
              },
            ],
          },
          field: 'messages',
        },
      ],
    },
  ],
};

// Interactive button reply
export const buttonReplyPayload: WhatsAppWebhookPayload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '102290129340398',
      changes: [
        {
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '15550001111',
              phone_number_id: PHONE_NUMBER_ID,
            },
            contacts: [
              {
                profile: { name: 'Juan Pérez' },
                wa_id: '5215551234567',
              },
            ],
            messages: [
              {
                from: '5215551234567',
                id: 'wamid.test_button_001',
                timestamp: '1704067260',
                type: 'interactive',
                interactive: {
                  type: 'button_reply',
                  button_reply: { id: 'RESERVAR', title: 'Reservar cita' },
                },
              },
            ],
          },
          field: 'messages',
        },
      ],
    },
  ],
};

// Interactive list reply
export const listReplyPayload: WhatsAppWebhookPayload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '102290129340398',
      changes: [
        {
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '15550001111',
              phone_number_id: PHONE_NUMBER_ID,
            },
            contacts: [
              {
                profile: { name: 'Juan Pérez' },
                wa_id: '5215551234567',
              },
            ],
            messages: [
              {
                from: '5215551234567',
                id: 'wamid.test_list_001',
                timestamp: '1704067320',
                type: 'interactive',
                interactive: {
                  type: 'list_reply',
                  list_reply: {
                    id: 'service-a-001',
                    title: 'Corte clásico',
                    description: '30 min — $15.00',
                  },
                },
              },
            ],
          },
          field: 'messages',
        },
      ],
    },
  ],
};

// Status update (delivered)
export const statusUpdatePayload: WhatsAppWebhookPayload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '102290129340398',
      changes: [
        {
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '15550001111',
              phone_number_id: PHONE_NUMBER_ID,
            },
            statuses: [
              {
                id: 'wamid.outgoing_001',
                recipient_id: '5215551234567',
                status: 'delivered',
                timestamp: '1704067400',
              },
            ],
          },
          field: 'messages',
        },
      ],
    },
  ],
};

// Payload for unknown phone_number_id (no matching tenant)
export const unknownPhonePayload: WhatsAppWebhookPayload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '102290129340398',
      changes: [
        {
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '15559999999',
              phone_number_id: 'unknown-phone-id-zzz',
            },
            contacts: [{ profile: { name: 'Desconocido' }, wa_id: '5219991234567' }],
            messages: [
              {
                from: '5219991234567',
                id: 'wamid.test_unknown_001',
                timestamp: '1704067500',
                type: 'text',
                text: { body: 'hola' },
              },
            ],
          },
          field: 'messages',
        },
      ],
    },
  ],
};
