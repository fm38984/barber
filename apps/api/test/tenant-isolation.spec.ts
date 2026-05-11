/**
 * Tenant isolation integration tests.
 *
 * These tests verify that Postgres RLS policies correctly prevent
 * cross-tenant data access. A query executed with tenant A's context
 * must never return tenant B's data, and vice versa.
 *
 * Requires a running Postgres instance with migrations applied.
 * Uses DATABASE_URL from environment (docker-compose postgres_test service).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { getTenantClient } from '@barberflow/db';

const DIRECT_URL =
  process.env['TEST_DATABASE_URL'] ??
  'postgresql://barberflow:password@localhost:5433/barberflow_test';

// Base client that bypasses RLS for test setup (uses superuser or BYPASSRLS role)
// In CI, the DB user is the owner so it has BYPASSRLS by default on tables it owns.
// In production, app_user does NOT have BYPASSRLS.
const setupClient = new PrismaClient({
  datasources: { db: { url: DIRECT_URL } },
});

// Fixed IDs for deterministic tests
const TENANT_A_ID = 'test-tenant-aaa-0001';
const TENANT_B_ID = 'test-tenant-bbb-0001';
const PLAN_ID = 'test-plan-0001';

async function seedTestData() {
  // Seed plan and two tenants using raw SQL to bypass RLS for setup
  await setupClient.$executeRaw`
    INSERT INTO plans (id, name, price_usd, max_barbers, max_appointments_month)
    VALUES (${PLAN_ID}, 'Test Plan', 29.99, 5, 200)
    ON CONFLICT (id) DO NOTHING
  `;

  await setupClient.$executeRaw`
    INSERT INTO tenants (id, name, slug, whatsapp_phone_number_id, status, plan_id, updated_at)
    VALUES
      (${TENANT_A_ID}, 'Barbería A', 'barberia-a', 'phone-id-aaa', 'ACTIVE', ${PLAN_ID}, NOW()),
      (${TENANT_B_ID}, 'Barbería B', 'barberia-b', 'phone-id-bbb', 'ACTIVE', ${PLAN_ID}, NOW())
    ON CONFLICT (id) DO NOTHING
  `;

  // Seed a barber for tenant A
  await setupClient.$executeRaw`
    INSERT INTO barbers (id, tenant_id, name, status, updated_at)
    VALUES ('barber-a-001', ${TENANT_A_ID}, 'Carlos (A)', 'ACTIVE', NOW())
    ON CONFLICT (id) DO NOTHING
  `;

  // Seed a barber for tenant B
  await setupClient.$executeRaw`
    INSERT INTO barbers (id, tenant_id, name, status, updated_at)
    VALUES ('barber-b-001', ${TENANT_B_ID}, 'Miguel (B)', 'ACTIVE', NOW())
    ON CONFLICT (id) DO NOTHING
  `;

  // Seed a service for tenant A
  await setupClient.$executeRaw`
    INSERT INTO services (id, tenant_id, name, duration_min, price_local, updated_at)
    VALUES ('service-a-001', ${TENANT_A_ID}, 'Corte A', 30, 15.00, NOW())
    ON CONFLICT (id) DO NOTHING
  `;

  // Seed a service for tenant B
  await setupClient.$executeRaw`
    INSERT INTO services (id, tenant_id, name, duration_min, price_local, updated_at)
    VALUES ('service-b-001', ${TENANT_B_ID}, 'Corte B', 45, 20.00, NOW())
    ON CONFLICT (id) DO NOTHING
  `;

  // Seed a customer for tenant A
  await setupClient.$executeRaw`
    INSERT INTO customers (id, tenant_id, whatsapp_phone, name, updated_at)
    VALUES ('customer-a-001', ${TENANT_A_ID}, '+5215551111111', 'Juan A', NOW())
    ON CONFLICT (id) DO NOTHING
  `;

  // Seed a customer for tenant B
  await setupClient.$executeRaw`
    INSERT INTO customers (id, tenant_id, whatsapp_phone, name, updated_at)
    VALUES ('customer-b-001', ${TENANT_B_ID}, '+5215552222222', 'Pedro B', NOW())
    ON CONFLICT (id) DO NOTHING
  `;
}

async function cleanupTestData() {
  // Cleanup in FK-safe order
  await setupClient.$executeRaw`DELETE FROM customers WHERE tenant_id IN (${TENANT_A_ID}, ${TENANT_B_ID})`;
  await setupClient.$executeRaw`DELETE FROM services WHERE tenant_id IN (${TENANT_A_ID}, ${TENANT_B_ID})`;
  await setupClient.$executeRaw`DELETE FROM barbers WHERE tenant_id IN (${TENANT_A_ID}, ${TENANT_B_ID})`;
  await setupClient.$executeRaw`DELETE FROM tenants WHERE id IN (${TENANT_A_ID}, ${TENANT_B_ID})`;
  await setupClient.$executeRaw`DELETE FROM plans WHERE id = ${PLAN_ID}`;
}

beforeAll(async () => {
  await seedTestData();
});

afterAll(async () => {
  await cleanupTestData();
  await setupClient.$disconnect();
});

describe('RLS — Tenant Isolation', () => {
  it('tenant A client only sees tenant A barbers', async () => {
    const dbA = getTenantClient(TENANT_A_ID);
    // @ts-expect-error — $transaction is on base client, extension wraps it
    const barbers = await dbA.barber.findMany();

    expect(barbers).toHaveLength(1);
    expect(barbers[0]?.name).toBe('Carlos (A)');
    expect(barbers[0]?.tenantId).toBe(TENANT_A_ID);
  });

  it('tenant B client only sees tenant B barbers', async () => {
    const dbB = getTenantClient(TENANT_B_ID);
    // @ts-expect-error
    const barbers = await dbB.barber.findMany();

    expect(barbers).toHaveLength(1);
    expect(barbers[0]?.name).toBe('Miguel (B)');
    expect(barbers[0]?.tenantId).toBe(TENANT_B_ID);
  });

  it('tenant A client cannot access tenant B barbers by ID', async () => {
    const dbA = getTenantClient(TENANT_A_ID);
    // @ts-expect-error
    const barber = await dbA.barber.findUnique({
      where: { id: 'barber-b-001' },
    });

    // RLS returns null instead of throwing — no row visible
    expect(barber).toBeNull();
  });

  it('tenant B client cannot access tenant A customers', async () => {
    const dbB = getTenantClient(TENANT_B_ID);
    // @ts-expect-error
    const customers = await dbB.customer.findMany();

    expect(customers).toHaveLength(1);
    expect(customers[0]?.whatsappPhone).toBe('+5215552222222');

    // Make sure tenant A's customer is NOT in the results
    const tenantACustomer = customers.find(
      (c: { id: string }) => c.id === 'customer-a-001',
    );
    expect(tenantACustomer).toBeUndefined();
  });

  it('tenant A cannot overwrite tenant B service via update', async () => {
    const dbA = getTenantClient(TENANT_A_ID);

    // Attempting to update a row that RLS hides should affect 0 rows
    // Prisma will throw because findUnique returns null, or update finds no match
    // @ts-expect-error
    const result = await dbA.service.updateMany({
      where: { id: 'service-b-001' },
      data: { name: 'HACKED' },
    });

    expect(result.count).toBe(0);

    // Verify tenant B's service is unchanged
    const [{ name }] = await setupClient.$queryRaw<[{ name: string }]>`
      SELECT name FROM services WHERE id = 'service-b-001'
    `;
    expect(name).toBe('Corte B');
  });

  it('no context set → all per-tenant tables return empty', async () => {
    // A client with an empty string context simulates missing context
    const dbNoContext = getTenantClient('');

    // @ts-expect-error
    const barbers = await dbNoContext.barber.findMany();
    // @ts-expect-error
    const customers = await dbNoContext.customer.findMany();

    expect(barbers).toHaveLength(0);
    expect(customers).toHaveLength(0);
  });

  it('platform tables (tenants) are readable without tenant context', async () => {
    // Platform tables don't have RLS — readable from base client
    const tenants = await setupClient.tenant.findMany({
      where: { id: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });

    expect(tenants).toHaveLength(2);
  });
});
