import { IsEnum, IsOptional, IsDateString } from 'class-validator';

export enum AppointmentStatusUpdate {
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  NO_SHOW = 'NO_SHOW',
  CANCELLED = 'CANCELLED',
}

export class UpdateAppointmentDto {
  @IsOptional()
  @IsEnum(AppointmentStatusUpdate)
  status?: AppointmentStatusUpdate;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  barberId?: string;
}
