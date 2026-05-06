import { IsString, MaxLength, MinLength } from 'class-validator';

export class CollaboratorByIdNumberQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  idNumber!: string;
}
