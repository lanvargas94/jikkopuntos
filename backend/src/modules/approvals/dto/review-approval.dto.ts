import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewApprovalDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  reviewNote?: string;
}
