import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMedicalLeaveBodyDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  clinicalSummary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  justification?: string;
}
