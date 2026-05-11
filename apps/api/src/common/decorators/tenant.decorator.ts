import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const TenantId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.tenantId) throw new Error('TenantId decorator used outside tenant context');
    return req.tenantId;
  },
);

export const AdminRole = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    return ctx.switchToHttp().getRequest<Request>().adminRole;
  },
);
