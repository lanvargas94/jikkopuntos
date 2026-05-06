import { IsIn, IsOptional, IsString } from 'class-validator';

/** Filtro de listado admin; ALL = sin filtro por estado. */
export class ListFormsQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['ALL', 'DRAFT', 'PUBLISHED', 'CLOSED'])
  status?: 'ALL' | 'DRAFT' | 'PUBLISHED' | 'CLOSED';
}
