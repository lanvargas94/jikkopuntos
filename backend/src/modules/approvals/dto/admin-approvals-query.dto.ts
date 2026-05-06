import { IsIn, IsOptional, IsString } from 'class-validator';
import {
  APPROVAL_CATEGORY,
  APPROVAL_STATUS,
} from '../../../common/constants/approval-request';

const CATEGORIES = Object.values(APPROVAL_CATEGORY) as string[];
const STATUSES = Object.values(APPROVAL_STATUS) as string[];

export class AdminApprovalsQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @IsIn(CATEGORIES)
  category?: string;
}
