import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ORGANIZATIONAL_DEPARTMENT_CODES } from '../../../common/constants/organizational-department';

export class CreateCollaboratorDto {
  @IsEmail()
  email!: string;

  /** Si se omite o queda vacío, el servidor genera una temporal y la devuelve una sola vez. */
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsString()
  @MinLength(8, { message: 'La contraseña temporal debe tener al menos 8 caracteres' })
  @MaxLength(128)
  temporaryPassword?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  lastName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  idNumber!: string;

  @IsDateString()
  idIssueDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  jobTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  area?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsIn(ORGANIZATIONAL_DEPARTMENT_CODES)
  organizationalDepartment?: string;
}
