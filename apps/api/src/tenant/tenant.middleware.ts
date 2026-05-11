import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createClerkClient } from '@clerk/backend';
import { TenantService } from './tenant.service';

// Extend Express Request with our tenant context
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenantId?: string;
      tenantStatus?: string;
      adminId?: string;
      adminRole?: 'OWNER' | 'MANAGER';
      isSuperAdmin?: boolean;
    }
  }
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);
  private readonly clerk = createClerkClient({
    secretKey: process.env['CLERK_SECRET_KEY'],
  });

  constructor(private readonly tenantService: TenantService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return next(new UnauthorizedException('Token de autorización requerido'));
    }

    const token = authHeader.slice(7);

    try {
      // Verify and decode the Clerk JWT
      const payload = await this.clerk.verifyToken(token);

      const clerkUserId = payload.sub;
      const role = payload['role'] as string | undefined;

      // Super admin path — full platform access, no tenant context
      if (role === 'super_admin') {
        req.isSuperAdmin = true;
        return next();
      }

      // Tenant admin path — resolve tenant from Clerk user
      const result = await this.tenantService.resolveByClerkUserId(clerkUserId);

      if (!result) {
        this.logger.warn({ clerkUserId }, 'Clerk user has no associated tenant admin');
        return next(new UnauthorizedException('Usuario no asociado a ninguna barbería'));
      }

      const { tenant, adminId, role: adminRole } = result;

      if (tenant.status === 'SUSPENDED') {
        return next(
          new ForbiddenException(
            'Esta barbería está suspendida. Contacta al soporte.',
          ),
        );
      }

      req.tenantId = tenant.id;
      req.tenantStatus = tenant.status;
      req.adminId = adminId;
      req.adminRole = adminRole;

      return next();
    } catch (err) {
      this.logger.warn({ err }, 'Token verification failed');
      return next(new UnauthorizedException('Token inválido o expirado'));
    }
  }
}
