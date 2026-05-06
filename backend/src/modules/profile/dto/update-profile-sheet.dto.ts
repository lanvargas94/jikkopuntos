import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { stripHtmlLoose } from '../../../common/utils/sanitize-input';

const trim = (v: unknown) =>
  typeof v === 'string' ? v.trim() : v;

/** '' / null → null (borrar campo); undefined no se envía */
const emptyToNull = (v: unknown) => {
  if (v === '' || v === null) return null;
  if (v === undefined) return undefined;
  return typeof v === 'string' ? v.trim() : v;
};

const sanitizeLongText = (v: unknown) => {
  const n = emptyToNull(v);
  if (n === null || n === undefined) return n;
  return typeof n === 'string' ? stripHtmlLoose(n) : n;
};

/**
 * Solo campos permitidos; idNumber / idIssueDate / email corporativo no existen aquí.
 */
export class UpdateProfileSheetDto {
  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  firstName?: string;

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  lastName?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, v) => v != null)
  @IsEmail()
  @MaxLength(254)
  personalEmail?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(40)
  phoneMobile?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(40)
  phoneAlt?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(120)
  city?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(120)
  emergencyContactName?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(40)
  emergencyContactPhone?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(80)
  emergencyRelationship?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(160)
  eps?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(160)
  arl?: string | null;

  @IsOptional()
  @Transform(({ value }) => sanitizeLongText(value))
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(16000)
  professionalSummary?: string | null;

  @IsOptional()
  @Transform(({ value }) => sanitizeLongText(value))
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(16000)
  educationBackground?: string | null;

  @IsOptional()
  @Transform(({ value }) => sanitizeLongText(value))
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(16000)
  previousWorkExperience?: string | null;

  @IsOptional()
  @Transform(({ value }) => sanitizeLongText(value))
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(16000)
  skills?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, v) => v != null)
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  linkedInUrl?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, v) => v != null)
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  profilePhotoUrl?: string | null;
}
