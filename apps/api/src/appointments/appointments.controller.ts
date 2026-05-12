import { Controller, Get, Patch, Param, Body, Query } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { TenantId } from '../common/decorators/tenant.decorator';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly svc: AppointmentsService) {}

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('barberId') barberId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.findAll(tenantId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      barberId,
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('week')
  findByWeek(@TenantId() tenantId: string, @Query('start') start: string) {
    return this.svc.findByWeek(tenantId, new Date(start ?? new Date()));
  }

  @Patch(':id')
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.svc.update(tenantId, id, dto);
  }
}
