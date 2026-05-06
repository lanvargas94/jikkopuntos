import { IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @MinLength(10, { message: 'refreshToken inválido' })
  refreshToken!: string;
}
