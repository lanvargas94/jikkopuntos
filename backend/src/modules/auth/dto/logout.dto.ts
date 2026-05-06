import { IsOptional, IsString, MinLength } from 'class-validator';

export class LogoutDto {
  /** Opcional: si se envía, se revoca esa sesión en servidor */
  @IsOptional()
  @IsString()
  @MinLength(10)
  refreshToken?: string;
}
