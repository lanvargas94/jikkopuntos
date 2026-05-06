import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { LEAVE_KIND } from '../../../common/constants/approval-request';

const KINDS = Object.values(LEAVE_KIND) as string[];

export class CreateLeaveDto {
  @IsString()
  @IsIn(KINDS)
  leaveKind!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(4000)
  justification!: string;
}
