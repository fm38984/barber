import { Controller, Get, Param, Query, Version } from '@nestjs/common';
import { CustomersAdminService } from './customers-admin.service';
import { TenantId } from '../common/decorators/tenant.decorator';

@Controller('customers')
@Version('1')
export class CustomersAdminController {
  constructor(private readonly svc: CustomersAdminService) {}

  @Get()
  findAll(
    @TenantId() t: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.findAll(t, { search, limit: limit ? +limit : undefined, offset: offset ? +offset : undefined });
  }

  @Get(':id')
  findOne(@TenantId() t: string, @Param('id') id: string) {
    return this.svc.findOneWithHistory(t, id);
  }
}
