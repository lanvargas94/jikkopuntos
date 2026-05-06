import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateBenefitTierDto {
  @IsString()
  @MinLength(1, { message: 'El nombre del beneficio es obligatorio.' })
  @MaxLength(200)
  label!: string;

  @IsInt()
  @Min(1, { message: 'La cantidad de jikkopuntos debe ser al menos 1.' })
  @Max(1_000_000_000)
  jp!: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
