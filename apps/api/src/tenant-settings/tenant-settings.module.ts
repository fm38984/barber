import { Module } from '@nestjs/common';
import { TenantSettingsService } from './tenant-settings.service';
import { TenantSettingsController } from './tenant-settings.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TenantSettingsController],
  providers: [TenantSettingsService],
})
export class TenantSettingsModule {}
