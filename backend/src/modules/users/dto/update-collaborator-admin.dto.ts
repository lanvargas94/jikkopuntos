import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ORGANIZATIONAL_DEPARTMENT_CODES } from '../../../common/constants/organizational-department';

export class UpdateCollaboratorAdminDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  jobTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  area?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, v) => v != null)
  @IsIn(ORGANIZATIONAL_DEPARTMENT_CODES)
  organizationalDepartment?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
