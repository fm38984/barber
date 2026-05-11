import { Controller, Get, Post, Patch, Delete, Param, Body, Version } from '@nestjs/common';
import { BarbersService } from './barbers.service';
import { CreateBarberDto } from './dto/create-barber.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { Roles } from '../auth/roles.decorator';

@Controller('barbers')
@Version('1')
export class BarbersController {
  constructor(private readonly svc: BarbersService) {}

  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.svc.findAll(tenantId);
  }

  @Get(':id')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.svc.findOne(tenantId, id);
  }

  @Post()
  @Roles('owner', 'manager')
  create(@TenantId() tenantId: string, @Body() dto: CreateBarberDto) {
    return this.svc.create(tenantId, dto);
  }

  @Patch(':id')
  @Roles('owner', 'manager')
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: Partial<CreateBarberDto>) {
    return this.svc.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('owner')
  deactivate(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.svc.deactivate(tenantId, id);
  }
}
