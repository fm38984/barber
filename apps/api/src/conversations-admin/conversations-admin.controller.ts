import { Controller, Get, Param, Patch, Query, Version } from '@nestjs/common';
import { ConversationsAdminService } from './conversations-admin.service';
import { TenantId } from '../common/decorators/tenant.decorator';

@Controller('conversations')
// @ts-ignore
@Version('1')
export class ConversationsAdminController {
  constructor(private readonly svc: ConversationsAdminService) {}

  @Get()
  findAll(@TenantId() t: string, @Query('status') status?: string) {
    return this.svc.findAll(t, status);
  }

  @Get(':id')
  findOne(@TenantId() t: string, @Param('id') id: string) {
    return this.svc.findOne(t, id);
  }

  @Patch(':id/release')
  release(@TenantId() t: string, @Param('id') id: string) {
    return this.svc.release(t, id);
  }

  @Patch(':id/take-control')
  takeControl(@TenantId() t: string, @Param('id') id: string) {
    return this.svc.takeControl(t, id);
  }
}
