import { Injectable, Logger, RawBodyRequest } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  readonly stripe: Stripe;

  constructor(private readonly prisma: PrismaService) {
    this.stripe = new Stripe(process.env['STRIPE_SECRET_KEY'] ?? '', {
      apiVersion: '2024-06-20',
    });
  }

  async createCustomerPortalSession(tenantId: string, returnUrl: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId, status: 'ACTIVE' },
    });

    if (!subscription?.stripeCustomerId) {
      throw new Error('No active subscription found');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  }

  async handleWebhookEvent(rawBody: Buffer, signature: string) {
    const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'] ?? '';
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      this.logger.error('Stripe webhook signature verification failed', err);
      throw err;
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.upsertSubscription(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.cancelSubscription(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
    }
  }

  private async upsertSubscription(sub: Stripe.Subscription) {
    const tenantId = sub.metadata?.['tenantId'];
    if (!tenantId) return;

    const planId = sub.metadata?.['planId'];
    const status = sub.status === 'active' ? 'ACTIVE' : sub.status === 'trialing' ? 'TRIALING' : 'PAST_DUE';

    await this.prisma.subscription.upsert({
      where: { stripeSubscriptionId: sub.id },
      create: {
        tenantId,
        planId: planId ?? '',
        stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
        stripeSubscriptionId: sub.id,
        status,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
      },
      update: {
        status,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
      },
    });

    if (status === 'ACTIVE') {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { status: 'ACTIVE' },
      });
    }
  }

  private async cancelSubscription(sub: Stripe.Subscription) {
    await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId: sub.id },
      data: { status: 'CANCELLED' },
    });

    const tenantId = sub.metadata?.['tenantId'];
    if (tenantId) {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { status: 'SUSPENDED' },
      });
    }
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (!customerId) return;

    await this.prisma.subscription.updateMany({
      where: { stripeCustomerId: customerId },
      data: { status: 'PAST_DUE' },
    });

    this.logger.warn(`Payment failed for Stripe customer ${customerId}`);
  }
}
