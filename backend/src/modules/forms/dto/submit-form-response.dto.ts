import { IsObject } from 'class-validator';

export class SubmitFormResponseDto {
  /** Mapa fieldId -> valor según el tipo definido en el schema */
  @IsObject()
  answers!: Record<string, unknown>;
}
