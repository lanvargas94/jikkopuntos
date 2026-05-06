import { IsString, MaxLength, MinLength } from 'class-validator';

export class RedeemBenefitDto {
  @IsString()
  @MinLength(1, { message: 'Debes elegir una recompensa válida.' })
  tierId!: string;

  @IsString()
  @MinLength(10, {
    message: 'Los comentarios deben tener al menos 10 caracteres.',
  })
  @MaxLength(2000)
  justification!: string;
}
