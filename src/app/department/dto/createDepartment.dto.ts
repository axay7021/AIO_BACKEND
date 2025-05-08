import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateDepartmentDto {
  @MaxLength(50, { message: 'DEPARTMENT_NAME_TOO_LONG' })
  @MinLength(3, { message: 'DEPARTMENT_NAME_TOO_SHORT' })
  @Matches(/^(?=.*[a-zA-Z])|([a-zA-Z]+)$/, {
    message: 'DEPARTMENT_NAME_CONTAINS_INVALID_CHARACTERS',
  })
  @IsString({ message: 'DEPARTMENT_NAME_MUST_BE_STRING' })
  @IsNotEmpty({ message: 'DEPARTMENT_NAME_REQUIRED' })
  @Transform(({ value }) => value.trim())
  departmentName: string;

  @IsNotEmpty({ message: 'DEPARTMENT_DESCRIPTION_REQUIRED' })
  @IsString({ message: 'DEPARTMENT_DESCRIPTION_MUST_BE_STRING' })
  @Matches(/\S/, { message: 'DEPARTMENT_DESCRIPTION_NO_WHITESPACE' })
  @Transform(({ value }) => value.trim())
  description: string;
}
