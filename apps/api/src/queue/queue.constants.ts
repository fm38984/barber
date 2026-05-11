export const QUEUES = {
  INCOMING_WHATSAPP: 'incoming-whatsapp-messages',
  REMINDERS: 'appointment-reminders',
} as const;

export const JOB_NAMES = {
  PROCESS_MESSAGE: 'process-incoming-message',
  SEND_REMINDER: 'send-reminder',
} as const;
