import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateDepartmentDto {
  @IsUUID('4', { message: 'DEPARTMENT_ID_INVALID' })
  departmentId: string;

  @IsOptional()
  @MaxLength(50, { message: 'DEPARTMENT_NAME_TOO_LONG' })
  @MinLength(3, { message: 'DEPARTMENT_NAME_TOO_SHORT' })
  @Matches(/^(?=.*[a-zA-Z])|([a-zA-Z]+)$/, {
    message: 'DEPARTMENT_NAME_CONTAINS_INVALID_CHARACTERS',
  })
  @IsString({ message: 'DEPARTMENT_NAME_MUST_BE_STRING' })
  @Transform(({ value }) => value.trim())
  departmentName: string;

  @IsOptional()
  @IsString({ message: 'DEPARTMENT_DESCRIPTION_MUST_BE_STRING' })
  @Matches(/\S/, { message: 'DEPARTMENT_DESCRIPTION_NO_WHITESPACE' })
  @Transform(({ value }) => value.trim())
  description: string;
}
