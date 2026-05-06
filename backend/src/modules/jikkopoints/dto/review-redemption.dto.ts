import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewRedemptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewNote?: string;
}
