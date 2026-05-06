import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class UpdateFormDefinitionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  pointsReward?: number;

  /** Slug para URL /forms/mi-slug (solo minusculas y guiones). Vacio o null quita el slug. */
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === undefined ? null : value,
  )
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(80)
  @Matches(SLUG_RE, {
    message: 'Slug: solo minusculas, numeros y guiones (ej. encuesta-enero)',
  })
  publicSlug?: string | null;

  @IsOptional()
  @IsBoolean()
  allowMultipleResponses?: boolean;
}
