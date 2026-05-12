import { Body, Controller, Get, Patch } from '@nestjs/common';
import { TenantSettingsService, UpdateTenantSettingsDto } from './tenant-settings.service';
import { TenantId } from '../common/decorators/tenant.decorator';

@Controller('settings')
export class TenantSettingsController {
  constructor(private readonly svc: TenantSettingsService) {}

  @Get()
  getSettings(@TenantId() t: string) {
    return this.svc.getSettings(t);
  }

  @Patch()
  updateSettings(@TenantId() t: string, @Body() dto: UpdateTenantSettingsDto) {
    return this.svc.updateSettings(t, dto);
  }
}
