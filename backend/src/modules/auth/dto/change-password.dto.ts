import { IsString, MaxLength, MinLength } from 'class-validator';
import { MatchField } from '../../../common/decorators/match-field.decorator';
import { PASSWORD_POLICY_HINT } from '../../../common/security/password-policy';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'Indica tu contraseña actual' })
  currentPassword!: string;

  @IsString()
  @MinLength(12, { message: PASSWORD_POLICY_HINT })
  @MaxLength(128, { message: 'La contraseña no puede superar 128 caracteres' })
  newPassword!: string;

  @IsString()
  @MinLength(12, { message: PASSWORD_POLICY_HINT })
  @MaxLength(128)
  @MatchField('newPassword', { message: 'La confirmación no coincide con la nueva contraseña' })
  confirmNewPassword!: string;
}
