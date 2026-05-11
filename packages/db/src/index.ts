export { prisma, getTenantClient } from './client';
export type { TenantClient } from './client';

// Re-export Prisma types for convenience
export {
  Prisma,
  PrismaClient,
  TenantStatus,
  SubscriptionStatus,
  TenantAdminRole,
  BarberStatus,
  AppointmentStatus,
  AppointmentCreatedVia,
  ConversationStatus,
  MessageDirection,
  MessageStatus,
  ReminderStatus,
} from '@prisma/client';

export type {
  Tenant,
  Plan,
  Subscription,
  SuperAdminUser,
  PlatformAuditLog,
  TenantAdmin,
  Barber,
  Service,
  Customer,
  Appointment,
  Conversation,
  Message,
  Reminder,
} from '@prisma/client';
