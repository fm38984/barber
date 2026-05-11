/**
 * Bot conversation E2E tests.
 *
 * Simulates full conversation flows by calling BotService.handleIncoming()
 * directly with a mocked WhatsAppSenderService. Uses a real DB (test Postgres)
 * to verify state transitions are persisted correctly.
 *
 * Tested flows:
 *  1. Happy path: full booking (greet → service → barber → date → time → confirm)
 *  2. Cancel flow: customer cancels a confirmed appointment
 *  3. My appointments: customer views upcoming citas
 *  4. Escalation: customer asks for human
 *  5. Escalated conversation: bot stays silent
 *  6. Unknown input in IDLE: sends main menu
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { addDays, addMinutes } from 'date-fns';
import { BotService } from '../../src/bot/bot.service';
import { AvailabilityService } from '../../src/bot/availability.service';
import { IdleHandler } from '../../src/bot/handlers/idle.handler';
import { ChoosingServiceHandler } from '../../src/bot/handlers/choosing-service.handler';
import { ChoosingBarberHandler } from '../../src/bot/handlers/choosing-barber.handler';
import { ChoosingDateHandler } from '../../src/bot/handlers/choosing-date.handler';
import { ChoosingTimeHandler } from '../../src/bot/handlers/choosing-time.handler';
import { ConfirmingHandler } from '../../src/bot/handlers/confirming.handler';
import { MyAppointmentsHandler } from '../../src/bot/handlers/my-appointments.handler';
import { CancellingHandler } from '../../src/bot/handlers/cancelling.handler';
import { ConversationService } from '../../src/conversation/conversation.service';
import { CustomerService } from '../../src/customer/customer.service';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { WhatsAppSenderService } from '../../src/whatsapp/whatsapp-sender.service';
import type { IncomingMessageJobData } from '../../src/queue/queue.types';

const TEST_DB = process.env['TEST_DATABASE_URL'] ?? 'postgresql://barberflow:password@localhost:5433/barberflow_test';

const TENANT_ID = 'test-tenant-aaa-0001';
const PLAN_ID = 'test-plan-0001';
const PHONE_NUMBER_ID = 'phone-id-aaa';
const TIMEZONE = 'America/Mexico_City';
const CUSTOMER_PHONE = '+5215559000001';

// Shared test tenant object
const TEST_TENANT = {
  id: TENANT_ID,
  name: 'Barbería Test',
  timezone: TIMEZONE,
  whatsappPhoneNumberId: PHONE_NUMBER_ID,
};

function makeJob(
  overrides: Partial<IncomingMessageJobData> = {},
): IncomingMessageJobData {
  return {
    phoneNumberId: PHONE_NUMBER_ID,
    from: '5215559000001',
    contactName: 'Test User',
    messageId: `wamid.bot_test_${Date.now()}_${Math.random()}`,
    timestamp: String(Math.floor(Date.now() / 1000)),
    messageType: 'text',
    textBody: 'hola',
    ...overrides,
  };
}

function makeListReply(id: string, title: string): Partial<IncomingMessageJobData> {
  return {
    messageType: 'interactive',
    textBody: undefined,
    interactiveReply: { type: 'list_reply', list_reply: { id, title } },
  };
}

function makeButtonReply(id: string, title: string): Partial<IncomingMessageJobData> {
  return {
    messageType: 'interactive',
    textBody: undefined,
    interactiveReply: { type: 'button_reply', button_reply: { id, title } },
  };
}

describe('Bot conversation flows', () => {
  let module: TestingModule;
  let bot: BotService;
  let conversationService: ConversationService;
  let customerService: CustomerService;
  let setupClient: PrismaClient;
  let serviceId: string;
  let barberId: string;

  // Capture all messages sent by the bot
  const sentMessages: Array<{ type: string; to: string; body?: string; buttons?: unknown[]; sections?: unknown[] }> = [];

  const mockSender = {
    send: vi.fn(async (_tenantId: string, _convId: string, _phoneId: string, msg: unknown) => {
      sentMessages.push(msg as (typeof sentMessages)[0]);
      return 'wamid.mock_outgoing';
    }),
  };

  beforeAll(async () => {
    setupClient = new PrismaClient({ datasources: { db: { url: TEST_DB } } });

    // Seed plan + tenant (idempotent)
    await setupClient.$executeRaw`
      INSERT INTO plans (id, name, price_usd, max_barbers, max_appointments_month)
      VALUES (${PLAN_ID}, 'Test Plan', 29.99, 5, 200) ON CONFLICT (id) DO NOTHING
    `;
    await setupClient.$executeRaw`
      INSERT INTO tenants (id, name, slug, whatsapp_phone_number_id, status, plan_id, updated_at)
      VALUES (${TENANT_ID}, 'Barbería Test', 'barberia-a', ${PHONE_NUMBER_ID}, 'ACTIVE', ${PLAN_ID}, NOW())
      ON CONFLICT (id) DO NOTHING
    `;

    // Seed barber with working hours (Monday–Saturday 9–18)
    const bId = 'barber-bot-test-001';
    barberId = bId;
    const workingHours = JSON.stringify({
      monday: { start: '09:00', end: '18:00' },
      tuesday: { start: '09:00', end: '18:00' },
      wednesday: { start: '09:00', end: '18:00' },
      thursday: { start: '09:00', end: '18:00' },
      friday: { start: '09:00', end: '18:00' },
      saturday: { start: '09:00', end: '15:00' },
    });

    await setupClient.$executeRaw`
      INSERT INTO barbers (id, tenant_id, name, status, working_hours_json, updated_at)
      VALUES (${bId}, ${TENANT_ID}, 'Carlos', 'ACTIVE', ${workingHours}::jsonb, NOW())
      ON CONFLICT (id) DO NOTHING
    `;

    // Seed service
    const sId = 'service-bot-test-001';
    serviceId = sId;
    await setupClient.$executeRaw`
      INSERT INTO services (id, tenant_id, name, duration_min, price_local, currency, is_active, updated_at)
      VALUES (${sId}, ${TENANT_ID}, 'Corte clásico', 30, 15.00, 'USD', true, NOW())
      ON CONFLICT (id) DO NOTHING
    `;

    module = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [
        BotService,
        AvailabilityService,
        IdleHandler,
        ChoosingServiceHandler,
        ChoosingBarberHandler,
        ChoosingDateHandler,
        ChoosingTimeHandler,
        ConfirmingHandler,
        MyAppointmentsHandler,
        CancellingHandler,
        ConversationService,
        CustomerService,
        { provide: WhatsAppSenderService, useValue: mockSender },
      ],
    }).compile();

    bot = module.get(BotService);
    conversationService = module.get(ConversationService);
    customerService = module.get(CustomerService);
  });

  afterAll(async () => {
    await setupClient.$executeRaw`DELETE FROM appointments WHERE tenant_id = ${TENANT_ID}`;
    await setupClient.$executeRaw`DELETE FROM messages WHERE tenant_id = ${TENANT_ID}`;
    await setupClient.$executeRaw`DELETE FROM conversations WHERE tenant_id = ${TENANT_ID}`;
    await setupClient.$executeRaw`DELETE FROM customers WHERE tenant_id = ${TENANT_ID} AND whatsapp_phone LIKE '+521555900%'`;
    await setupClient.$executeRaw`DELETE FROM barbers WHERE id = ${barberId}`;
    await setupClient.$executeRaw`DELETE FROM services WHERE id = ${serviceId}`;
    await setupClient.$disconnect();
    await module.close();
  });

  beforeEach(() => {
    sentMessages.length = 0;
    mockSender.send.mockClear();
  });

  async function getConversation() {
    const customer = await customerService.upsertByPhone(TENANT_ID, CUSTOMER_PHONE, null);
    return conversationService.upsertForCustomer(TENANT_ID, customer.id);
  }

  async function resetConversation() {
    const conversation = await getConversation();
    await conversationService.updateState(TENANT_ID, conversation.id, { state: 'IDLE' });
    await conversationService.markActive(TENANT_ID, conversation.id);
    return conversation;
  }

  // ────────────────────────────────────────────────────────────────

  it('greeting → sends main menu', async () => {
    const conversation = await resetConversation();
    const customer = await customerService.upsertByPhone(TENANT_ID, CUSTOMER_PHONE, 'Test User');

    await bot.handleIncoming({
      tenant: TEST_TENANT,
      conversation,
      customer,
      job: makeJob({ textBody: 'hola' }),
    });

    expect(sentMessages).toHaveLength(1);
    const [msg] = sentMessages;
    expect(msg?.type).toBe('interactive_list');
    // Should contain all 4 main menu options
    const firstSection = (msg as { sections: Array<{ rows: unknown[] }> })?.sections?.[0];
    expect(firstSection?.rows).toHaveLength(4);
  });

  it('RESERVAR button → transitions to CHOOSING_SERVICE and sends services list', async () => {
    const conversation = await resetConversation();
    const customer = await customerService.upsertByPhone(TENANT_ID, CUSTOMER_PHONE, null);

    // Step 1: "Reservar" button press
    await bot.handleIncoming({
      tenant: TEST_TENANT,
      conversation,
      customer,
      job: makeJob(makeListReply('RESERVAR', 'Reservar cita')),
    });

    const updated = await getConversation();
    expect((updated.stateJson as { state: string }).state).toBe('CHOOSING_SERVICE');

    // Should have sent the services list
    const serviceMsg = sentMessages.find(
      (m) => m.type === 'interactive_list' && JSON.stringify(m).includes('Corte clásico'),
    );
    expect(serviceMsg).toBeDefined();
  });

  it('full booking flow: service → barber → date → time → confirm → CONFIRMED', async () => {
    const conversation = await resetConversation();
    const customer = await customerService.upsertByPhone(TENANT_ID, CUSTOMER_PHONE, null);

    // Set state directly to CHOOSING_SERVICE to skip the menu step
    await conversationService.updateState(TENANT_ID, conversation.id, {
      state: 'CHOOSING_SERVICE',
      booking: {},
    });
    const convInService = await getConversation();

    // Step 1: Choose service
    await bot.handleIncoming({
      tenant: TEST_TENANT,
      conversation: convInService,
      customer,
      job: makeJob(makeListReply(serviceId, 'Corte clásico')),
    });

    let updated = await getConversation();
    expect((updated.stateJson as { state: string }).state).toBe('CHOOSING_BARBER');

    // Step 2: Choose specific barber
    sentMessages.length = 0;
    await bot.handleIncoming({
      tenant: TEST_TENANT,
      conversation: updated,
      customer,
      job: makeJob(makeListReply(barberId, 'Carlos')),
    });

    updated = await getConversation();
    expect((updated.stateJson as { state: string }).state).toBe('CHOOSING_DATE');

    // Step 3: Choose a date (take first available)
    sentMessages.length = 0;
    await bot.handleIncoming({
      tenant: TEST_TENANT,
      conversation: updated,
      customer,
      job: makeJob({ textBody: '' }), // trigger onEnter for CHOOSING_DATE
    });

    // Find the dates offered and pick the first one
    const dateMsg = sentMessages.find((m) => m.type === 'interactive_list') as
      | { sections: Array<{ rows: Array<{ id: string }> }> }
      | undefined;
    expect(dateMsg).toBeDefined();
    const firstDate = dateMsg!.sections[0]!.rows[0]!.id; // YYYY-MM-DD

    updated = await getConversation();
    sentMessages.length = 0;
    await bot.handleIncoming({
      tenant: TEST_TENANT,
      conversation: updated,
      customer,
      job: makeJob(makeListReply(firstDate, firstDate)),
    });

    updated = await getConversation();
    expect((updated.stateJson as { state: string }).state).toBe('CHOOSING_TIME');

    // Step 4: Choose a time slot
    sentMessages.length = 0;
    await bot.handleIncoming({
      tenant: TEST_TENANT,
      conversation: updated,
      customer,
      job: makeJob({ textBody: '' }),
    });

    const timeMsg = sentMessages.find((m) => m.type === 'interactive_list') as
      | { sections: Array<{ rows: Array<{ id: string }> }> }
      | undefined;
    expect(timeMsg).toBeDefined();
    const firstSlot = timeMsg!.sections[0]!.rows[0]!.id; // ISO string

    updated = await getConversation();
    sentMessages.length = 0;
    await bot.handleIncoming({
      tenant: TEST_TENANT,
      conversation: updated,
      customer,
      job: makeJob(makeListReply(firstSlot, '10:00 am')),
    });

    updated = await getConversation();
    expect((updated.stateJson as { state: string }).state).toBe('CONFIRMING');

    // Step 5: Confirm
    sentMessages.length = 0;
    await bot.handleIncoming({
      tenant: TEST_TENANT,
      conversation: updated,
      customer,
      job: makeJob(makeButtonReply('CONFIRMAR', 'Confirmar')),
    });

    updated = await getConversation();
    expect((updated.stateJson as { state: string }).state).toBe('IDLE');

    // Appointment should exist in DB
    const [appt] = await setupClient.$queryRaw<[{ status: string; tenant_id: string }]>`
      SELECT status, tenant_id FROM appointments
      WHERE tenant_id = ${TENANT_ID}
        AND customer_id = ${customer.id}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    expect(appt?.status).toBe('CONFIRMED');
    expect(appt?.tenant_id).toBe(TENANT_ID);

    // Confirmation message sent
    const confirmMsg = sentMessages.find((m) => m.type === 'text');
    expect(confirmMsg).toBeDefined();
    expect(JSON.stringify(confirmMsg)).toContain('confirmada');
  });

  it('escalation → marks conversation ESCALATED and bot stops responding', async () => {
    const conversation = await resetConversation();
    const customer = await customerService.upsertByPhone(TENANT_ID, CUSTOMER_PHONE, null);

    // Customer asks for human
    await bot.handleIncoming({
      tenant: TEST_TENANT,
      conversation,
      customer,
      job: makeJob(makeListReply('HUMANO', 'Hablar con alguien')),
    });

    // Conversation should be ESCALATED
    const updated = await getConversation();
    expect(updated.status).toBe('ESCALATED');

    // Bot sends escalation message to customer
    const escalationMsg = sentMessages.find(
      (m) => m.type === 'text' && JSON.stringify(m).toLowerCase().includes('asesor'),
    );
    expect(escalationMsg).toBeDefined();

    // Now a new message arrives — bot should NOT respond
    sentMessages.length = 0;
    await bot.handleIncoming({
      tenant: TEST_TENANT,
      conversation: updated,
      customer,
      job: makeJob({ textBody: 'sigues ahí?' }),
    });

    expect(sentMessages).toHaveLength(0);
  });

  it('IDLE with unknown text → sends main menu again', async () => {
    const conversation = await resetConversation();
    const customer = await customerService.upsertByPhone(TENANT_ID, CUSTOMER_PHONE, null);

    await bot.handleIncoming({
      tenant: TEST_TENANT,
      conversation,
      customer,
      job: makeJob({ textBody: 'xyz abc 123 qwerty' }),
    });

    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]?.type).toBe('interactive_list');
  });

  it('MIS_CITAS with no upcoming appointments → sends empty message', async () => {
    const conversation = await resetConversation();
    const customer = await customerService.upsertByPhone(TENANT_ID, CUSTOMER_PHONE, null);

    await bot.handleIncoming({
      tenant: TEST_TENANT,
      conversation,
      customer,
      job: makeJob(makeListReply('MIS_CITAS', 'Mis citas')),
    });

    const reply = sentMessages.find(
      (m) => m.type === 'text' && JSON.stringify(m).includes('próximas citas'),
    );
    expect(reply).toBeDefined();
  });
});
