import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { TenantModule } from './tenant/tenant.module';
import { TenantMiddleware } from './tenant/tenant.middleware';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { QueueModule } from './queue/queue.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { BotModule } from './bot/bot.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { BarbersModule } from './barbers/barbers.module';
import { ServicesCatalogModule } from './services-catalog/services-catalog.module';
import { CustomersAdminModule } from './customers-admin/customers-admin.module';
import { ConversationsAdminModule } from './conversations-admin/conversations-admin.module';
import { TenantSettingsModule } from './tenant-settings/tenant-settings.module';
import { RemindersModule } from './reminders/reminders.module';
import { ReportsModule } from './reports/reports.module';
import { StripeModule } from './stripe/stripe.module';
import { SuperAdminModule } from './super-admin/super-admin.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
        transport:
          process.env['NODE_ENV'] !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        serializers: {
          req(req: { method: string; url: string }) {
            return { method: req.method, url: req.url };
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        customProps: (req: any) => ({
          tenant_id: req.tenantId as string | undefined,
        }),
      },
    }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 60_000, limit: 200 },
    ]),
    PrismaModule,
    QueueModule,
    TenantModule,
    AuthModule,
    HealthModule,
    WhatsAppModule,
    BotModule,
    AppointmentsModule,
    BarbersModule,
    ServicesCatalogModule,
    CustomersAdminModule,
    ConversationsAdminModule,
    TenantSettingsModule,
    RemindersModule,
    ReportsModule,
    StripeModule,
    SuperAdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        'health',
        'v1/webhooks/whatsapp',
        'v1/webhooks/stripe',
      )
      .forRoutes('*');
  }
}
