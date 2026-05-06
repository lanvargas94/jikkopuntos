import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const QUESTION_TYPE_VALUES = [
  'TEXT_OPEN',
  'SINGLE_SELECT',
  'MULTI_SELECT',
] as const;

export class FormQuestionOptionInputDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  @IsString()
  @MaxLength(500)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  value?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class FormQuestionInputDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  @IsIn([...QUESTION_TYPE_VALUES])
  type!: (typeof QUESTION_TYPE_VALUES)[number];

  @IsString()
  @MaxLength(500)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  helpText?: string;

  @IsBoolean()
  required!: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ValidateIf(
    (o: FormQuestionInputDto) =>
      o.type === 'SINGLE_SELECT' || o.type === 'MULTI_SELECT',
  )
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => FormQuestionOptionInputDto)
  options?: FormQuestionOptionInputDto[];

}

export class ReplaceFormQuestionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormQuestionInputDto)
  questions!: FormQuestionInputDto[];
}
