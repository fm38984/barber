import { Module } from '@nestjs/common';
import { CustomersAdminService } from './customers-admin.service';
import { CustomersAdminController } from './customers-admin.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CustomersAdminController],
  providers: [CustomersAdminService],
})
export class CustomersAdminModule {}
