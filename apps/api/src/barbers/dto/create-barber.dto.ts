import { IsString, IsOptional, IsNotEmpty, IsObject, IsNumber, Min, Max } from 'class-validator';
import type { WeeklySchedule } from '@barberflow/shared-types';

export class CreateBarberDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  whatsappPhone?: string;

  @IsOptional()
  @IsObject()
  workingHoursJson?: WeeklySchedule;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPct?: number;
}
