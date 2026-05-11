import { Controller, Get, Post, Patch, Delete, Param, Body, Version } from '@nestjs/common';
import { ServicesCatalogService } from './services-catalog.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { Roles } from '../auth/roles.decorator';

@Controller('services')
@Version('1')
export class ServicesCatalogController {
  constructor(private readonly svc: ServicesCatalogService) {}

  @Get()
  findAll(@TenantId() t: string) { return this.svc.findAll(t); }

  @Post()
  @Roles('owner', 'manager')
  create(@TenantId() t: string, @Body() dto: CreateServiceDto) { return this.svc.create(t, dto); }

  @Patch(':id')
  @Roles('owner', 'manager')
  update(@TenantId() t: string, @Param('id') id: string, @Body() dto: Partial<CreateServiceDto>) {
    return this.svc.update(t, id, dto);
  }

  @Delete(':id')
  @Roles('owner')
  deactivate(@TenantId() t: string, @Param('id') id: string) { return this.svc.deactivate(t, id); }
}
