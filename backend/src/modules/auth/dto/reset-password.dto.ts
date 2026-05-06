import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/i, {
    message: 'Enlace de recuperación inválido.',
  })
  token!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  confirmNewPassword!: string;
}
