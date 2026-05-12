import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { StripeService } from './stripe.service';
import { Public } from '../auth/roles.decorator';

@Controller('webhooks/stripe')
@SkipThrottle()
export class StripeWebhookController {
  constructor(private readonly svc: StripeService) {}

  @Post()
  @Public()
  @HttpCode(200)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') sig: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) throw new Error('Raw body not available');
    await this.svc.handleWebhookEvent(rawBody, sig);
    return { received: true };
  }
}
