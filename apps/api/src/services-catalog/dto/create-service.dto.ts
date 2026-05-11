import { IsString, IsNotEmpty, IsInt, Min, IsNumber, IsOptional } from 'class-validator';

export class CreateServiceDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsInt() @Min(5) durationMin!: number;
  @IsNumber() @Min(0) priceLocal!: number;
  @IsOptional() @IsString() currency?: string;
}
