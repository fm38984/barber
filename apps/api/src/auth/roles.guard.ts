import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, type AppRole } from './roles.decorator';
import { Request } from 'express';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AppRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request>();

    if (req.isSuperAdmin && requiredRoles.includes('super_admin')) return true;
    if (req.isSuperAdmin) return true; // super admin can do anything

    const adminRole = req.adminRole?.toLowerCase() as AppRole | undefined;
    if (!adminRole) throw new ForbiddenException('Acceso no autorizado');

    if (!requiredRoles.includes(adminRole)) {
      throw new ForbiddenException(
        'No tienes permisos suficientes para esta acción',
      );
    }

    return true;
  }
}
