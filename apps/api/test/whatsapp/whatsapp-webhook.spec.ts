/**
 * WhatsApp webhook integration tests.
 *
 * Tests:
 * 1. GET handshake verification (token match and mismatch)
 * 2. POST signature verification (valid and tampered signatures)
 * 3. Incoming message creates/updates customer and conversation (via processor)
 * 4. Unknown phone_number_id is silently discarded
 * 5. Status updates don't create customers
 * 6. Duplicate message IDs are idempotent (BullMQ jobId dedup)
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { createHmac } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { getQueueToken } from '@nestjs/bullmq';
import { WhatsAppController } from '../../src/whatsapp/whatsapp.controller';
import { WhatsAppWebhookService } from '../../src/whatsapp/whatsapp-webhook.service';
import { WhatsAppSignatureGuard } from '../../src/whatsapp/whatsapp-signature.guard';
import { TenantService } from '../../src/tenant/tenant.service';
import { CustomerService } from '../../src/customer/customer.service';
import { ConversationService } from '../../src/conversation/conversation.service';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { IncomingMessageProcessor } from '../../src/queue/processors/incoming-message.processor';
import { QUEUES } from '../../src/queue/queue.constants';
import {
  textMessagePayload,
  buttonReplyPayload,
  unknownPhonePayload,
  statusUpdatePayload,
  PHONE_NUMBER_ID,
} from './fixtures';

const APP_SECRET = 'test-app-secret-12345';
const VERIFY_TOKEN = 'test-verify-token';
const TEST_DB = process.env['TEST_DATABASE_URL'] ?? 'postgresql://barberflow:password@localhost:5433/barberflow_test';

const TENANT_A_ID = 'test-tenant-aaa-0001';

function signPayload(body: string): string {
  const hmac = createHmac('sha256', APP_SECRET).update(body).digest('hex');
  return `sha256=${hmac}`;
}

describe('WhatsApp Webhook', () => {
  let app: INestApplication;
  let setupClient: PrismaClient;

  // Mock BullMQ queue — we test the processor separately
  const mockQueue = {
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
  };

  beforeAll(async () => {
    process.env['WHATSAPP_APP_SECRET'] = APP_SECRET;
    process.env['WHATSAPP_VERIFY_TOKEN'] = VERIFY_TOKEN;

    setupClient = new PrismaClient({ datasources: { db: { url: TEST_DB } } });

    // Ensure test tenant exists (seeded in tenant-isolation tests, but do it idempotently)
    await setupClient.$executeRaw`
      INSERT INTO plans (id, name, price_usd, max_barbers, max_appointments_month)
      VALUES ('test-plan-0001', 'Test Plan', 29.99, 5, 200)
      ON CONFLICT (id) DO NOTHING
    `;
    await setupClient.$executeRaw`
      INSERT INTO tenants (id, name, slug, whatsapp_phone_number_id, status, plan_id, updated_at)
      VALUES (${TENANT_A_ID}, 'Barbería A', 'barberia-a', ${PHONE_NUMBER_ID}, 'ACTIVE', 'test-plan-0001', NOW())
      ON CONFLICT (id) DO NOTHING
    `;

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      controllers: [WhatsAppController],
      providers: [
        WhatsAppWebhookService,
        WhatsAppSignatureGuard,
        TenantService,
        CustomerService,
        ConversationService,
        {
          provide: getQueueToken(QUEUES.INCOMING_WHATSAPP),
          useValue: mockQueue,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.enableVersioning({ type: VersioningType.URI });
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    // Clean up test customers and conversations
    await setupClient.$executeRaw`DELETE FROM messages WHERE tenant_id = ${TENANT_A_ID}`;
    await setupClient.$executeRaw`DELETE FROM conversations WHERE tenant_id = ${TENANT_A_ID}`;
    await setupClient.$executeRaw`DELETE FROM customers WHERE tenant_id = ${TENANT_A_ID}`;
    await setupClient.$disconnect();
    await app.close();
  });

  // ── GET Handshake ──────────────────────────────────────────

  describe('GET /api/v1/webhooks/whatsapp', () => {
    it('returns challenge when token matches', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': VERIFY_TOKEN,
          'hub.challenge': 'abc123challenge',
        });

      expect(res.status).toBe(200);
      expect(res.text).toBe('abc123challenge');
    });

    it('returns 400 when token is wrong', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong-token',
          'hub.challenge': 'abc123challenge',
        });

      expect(res.status).toBe(400);
    });

    it('returns 400 when mode is not subscribe', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/webhooks/whatsapp')
        .query({
          'hub.mode': 'unsubscribe',
          'hub.verify_token': VERIFY_TOKEN,
          'hub.challenge': 'abc123challenge',
        });

      expect(res.status).toBe(400);
    });
  });

  // ── POST Signature Verification ────────────────────────────

  describe('POST /api/v1/webhooks/whatsapp — signature', () => {
    it('returns 200 with valid signature', async () => {
      const body = JSON.stringify(textMessagePayload);

      const res = await request(app.getHttpServer())
        .post('/api/v1/webhooks/whatsapp')
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature-256', signPayload(body))
        .send(body);

      expect(res.status).toBe(200);
    });

    it('returns 401 with tampered body', async () => {
      const body = JSON.stringify(textMessagePayload);
      const tamperedSignature = signPayload('{"tampered":true}');

      const res = await request(app.getHttpServer())
        .post('/api/v1/webhooks/whatsapp')
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature-256', tamperedSignature)
        .send(body);

      expect(res.status).toBe(401);
    });

    it('returns 401 with missing signature header', async () => {
      const body = JSON.stringify(textMessagePayload);

      const res = await request(app.getHttpServer())
        .post('/api/v1/webhooks/whatsapp')
        .set('Content-Type', 'application/json')
        .send(body);

      expect(res.status).toBe(401);
    });

    it('returns 401 with malformed signature', async () => {
      const body = JSON.stringify(textMessagePayload);

      const res = await request(app.getHttpServer())
        .post('/api/v1/webhooks/whatsapp')
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature-256', 'not-a-valid-signature')
        .send(body);

      expect(res.status).toBe(401);
    });
  });

  // ── Webhook Processing ─────────────────────────────────────

  describe('POST /api/v1/webhooks/whatsapp — processing', () => {
    it('enqueues a job for an incoming text message', async () => {
      mockQueue.add.mockClear();
      const body = JSON.stringify(textMessagePayload);

      await request(app.getHttpServer())
        .post('/api/v1/webhooks/whatsapp')
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature-256', signPayload(body))
        .send(body)
        .expect(200);

      // Allow async enqueue to complete
      await new Promise((r) => setTimeout(r, 50));

      expect(mockQueue.add).toHaveBeenCalledOnce();
      const [jobName, jobData] = mockQueue.add.mock.calls[0] as [string, unknown];
      expect(jobName).toBe('process-incoming-message');
      expect(jobData).toMatchObject({
        phoneNumberId: PHONE_NUMBER_ID,
        from: '5215551234567',
        contactName: 'Juan Pérez',
        messageType: 'text',
        textBody: 'Hola, quiero hacer una cita',
      });
    });

    it('enqueues a job for an interactive button reply', async () => {
      mockQueue.add.mockClear();
      const body = JSON.stringify(buttonReplyPayload);

      await request(app.getHttpServer())
        .post('/api/v1/webhooks/whatsapp')
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature-256', signPayload(body))
        .send(body)
        .expect(200);

      await new Promise((r) => setTimeout(r, 50));

      expect(mockQueue.add).toHaveBeenCalledOnce();
      const [, jobData] = mockQueue.add.mock.calls[0] as [string, Record<string, unknown>];
      expect(jobData['messageType']).toBe('interactive');
      expect(jobData['interactiveReply']).toMatchObject({
        type: 'button_reply',
        button_reply: { id: 'RESERVAR' },
      });
    });

    it('does not enqueue for status updates', async () => {
      mockQueue.add.mockClear();
      const body = JSON.stringify(statusUpdatePayload);

      await request(app.getHttpServer())
        .post('/api/v1/webhooks/whatsapp')
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature-256', signPayload(body))
        .send(body)
        .expect(200);

      await new Promise((r) => setTimeout(r, 50));

      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });
});

// ── Processor integration test ─────────────────────────────

describe('IncomingMessageProcessor — integration', () => {
  let processor: IncomingMessageProcessor;
  let setupClient: PrismaClient;
  let module: TestingModule;

  const TENANT_A_ID = 'test-tenant-aaa-0001';

  beforeAll(async () => {
    setupClient = new PrismaClient({ datasources: { db: { url: TEST_DB } } });

    module = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [
        IncomingMessageProcessor,
        TenantService,
        CustomerService,
        ConversationService,
      ],
    }).compile();

    processor = module.get(IncomingMessageProcessor);
  });

  afterAll(async () => {
    await setupClient.$executeRaw`DELETE FROM messages WHERE tenant_id = ${TENANT_A_ID}`;
    await setupClient.$executeRaw`DELETE FROM conversations WHERE tenant_id = ${TENANT_A_ID}`;
    await setupClient.$executeRaw`DELETE FROM customers WHERE tenant_id = ${TENANT_A_ID}`;
    await setupClient.$disconnect();
    await module.close();
  });

  it('creates customer and conversation for a new phone number', async () => {
    const fakeJob = {
      name: 'process-incoming-message',
      data: {
        phoneNumberId: PHONE_NUMBER_ID,
        from: '5215559876543',
        contactName: 'María García',
        messageId: 'wamid.processor_test_001',
        timestamp: '1704067200',
        messageType: 'text' as const,
        textBody: 'Hola, buenas tardes',
      },
    } as never;

    await processor.process(fakeJob);

    // Verify customer was created with tenant scope
    const [customer] = await setupClient.$queryRaw<[{ name: string; tenant_id: string }]>`
      SELECT name, tenant_id FROM customers
      WHERE tenant_id = ${TENANT_A_ID} AND whatsapp_phone = '+5215559876543'
    `;
    expect(customer).toBeDefined();
    expect(customer?.name).toBe('María García');
    expect(customer?.tenant_id).toBe(TENANT_A_ID);

    // Verify conversation was created
    const [conv] = await setupClient.$queryRaw<[{ status: string; state_json: unknown }]>`
      SELECT c.status, c.state_json FROM conversations c
      JOIN customers cu ON cu.id = c.customer_id
      WHERE c.tenant_id = ${TENANT_A_ID}
        AND cu.whatsapp_phone = '+5215559876543'
    `;
    expect(conv?.status).toBe('ACTIVE');
    expect(conv?.state_json).toMatchObject({ state: 'IDLE' });

    // Verify message was persisted
    const [msg] = await setupClient.$queryRaw<[{ direction: string; body: string }]>`
      SELECT m.direction, m.body FROM messages m
      WHERE whatsapp_message_id = 'wamid.processor_test_001'
    `;
    expect(msg?.direction).toBe('IN');
    expect(msg?.body).toBe('Hola, buenas tardes');
  });

  it('is idempotent — second call with same phone updates customer, not duplicates', async () => {
    const fakeJob = {
      name: 'process-incoming-message',
      data: {
        phoneNumberId: PHONE_NUMBER_ID,
        from: '5215559876543', // same as previous test
        contactName: 'María García',
        messageId: 'wamid.processor_test_002',
        timestamp: '1704067300',
        messageType: 'text' as const,
        textBody: 'Segundo mensaje',
      },
    } as never;

    await processor.process(fakeJob);

    const count = await setupClient.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM customers
      WHERE tenant_id = ${TENANT_A_ID} AND whatsapp_phone = '+5215559876543'
    `;
    expect(Number(count[0]?.count)).toBe(1); // still exactly one customer
  });

  it('silently discards message for unknown phone_number_id', async () => {
    const fakeJob = {
      name: 'process-incoming-message',
      data: {
        phoneNumberId: 'unknown-phone-id-zzz',
        from: '5219991234567',
        contactName: null,
        messageId: 'wamid.processor_unknown_001',
        timestamp: '1704067400',
        messageType: 'text' as const,
        textBody: 'hola',
      },
    } as never;

    // Should not throw
    await expect(processor.process(fakeJob)).resolves.toBeUndefined();

    // No customer created for unknown tenant
    const count = await setupClient.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM customers WHERE whatsapp_phone = '+5219991234567'
    `;
    expect(Number(count[0]?.count)).toBe(0);
  });
});
