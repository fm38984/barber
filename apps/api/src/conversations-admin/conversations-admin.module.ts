import { Module } from '@nestjs/common';
import { ConversationsAdminService } from './conversations-admin.service';
import { ConversationsAdminController } from './conversations-admin.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ConversationsAdminController],
  providers: [ConversationsAdminService],
})
export class ConversationsAdminModule {}
