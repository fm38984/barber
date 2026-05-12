import { Controller, Get, Header, Query, Version } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { TenantId } from '../common/decorators/tenant.decorator';

@Controller('reports')
// @ts-ignore
@Version('1')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  private parseDates(fromQ?: string, toQ?: string) {
    const to = toQ ? new Date(toQ) : new Date();
    const from = fromQ ? new Date(fromQ) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { from, to };
  }

  @Get('summary')
  getSummary(
    @TenantId() t: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const dates = this.parseDates(from, to);
    return this.svc.getSummary(t, dates.from, dates.to);
  }

  @Get('daily')
  getDailyBreakdown(
    @TenantId() t: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const dates = this.parseDates(from, to);
    return this.svc.getDailyBreakdown(t, dates.from, dates.to);
  }

  @Get('export/csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="reporte.csv"')
  async exportCsv(
    @TenantId() t: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const dates = this.parseDates(from, to);
    return this.svc.exportCsv(t, dates.from, dates.to);
  }
}
