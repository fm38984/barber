import { Body, Controller, Get, Param, Patch, Post, Query, Version } from '@nestjs/common';
import { SuperAdminService, CreateTenantDto } from './super-admin.service';
import { Roles } from '../auth/roles.decorator';

@Controller('super-admin')
@Version('1')
@Roles('super_admin')
export class SuperAdminController {
  constructor(private readonly svc: SuperAdminService) {}

  @Get('metrics')
  getMetrics() {
    return this.svc.getPlatformMetrics();
  }

  @Get('tenants')
  listTenants(@Query('search') search?: string) {
    return this.svc.listTenants(search);
  }

  @Get('tenants/:id')
  getTenant(@Param('id') id: string) {
    return this.svc.getTenant(id);
  }

  @Post('tenants')
  createTenant(@Body() dto: CreateTenantDto) {
    return this.svc.createTenant(dto);
  }

  @Patch('tenants/:id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: 'ACTIVE' | 'SUSPENDED') {
    return this.svc.updateTenantStatus(id, status);
  }

  @Get('plans')
  listPlans() {
    return this.svc.listPlans();
  }
}
