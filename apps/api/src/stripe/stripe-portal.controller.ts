import { Body, Controller, Post } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { TenantId } from '../common/decorators/tenant.decorator';

@Controller('billing/portal')
export class StripePortalController {
  constructor(private readonly svc: StripeService) {}

  @Post()
  createPortalSession(
    @TenantId() t: string,
    @Body('returnUrl') returnUrl: string,
  ) {
    return this.svc.createCustomerPortalSession(t, returnUrl ?? 'http://localhost:3000/dashboard');
  }
}
