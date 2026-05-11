import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripePortalController } from './stripe-portal.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StripeWebhookController, StripePortalController],
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
