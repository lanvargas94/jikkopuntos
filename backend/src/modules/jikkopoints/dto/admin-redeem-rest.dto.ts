import { IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import type { RedeemRestKind } from '../constants/redeem-rest';

export class AdminRedeemRestDto {
  @IsUUID('4')
  targetUserId!: string;

  @IsIn(['REST_HALF_DAY', 'REST_FULL_DAY'])
  kind!: RedeemRestKind;

  @IsString()
  @MinLength(10, {
    message: 'La justificación debe tener al menos 10 caracteres.',
  })
  @MaxLength(2000)
  justification!: string;
}
