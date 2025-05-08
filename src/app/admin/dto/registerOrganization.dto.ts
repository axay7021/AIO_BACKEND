import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class OrganizationRegisterDto {
  @IsString({ message: 'ORGANIZATION_NAME_MUST_BE_STRING' })
  @IsNotEmpty({ message: 'ORGANIZATION_REQUIRED' })
  @MinLength(2, { message: 'ORGANIZATION_NAME_TOO_SHORT' })
  @MaxLength(50, { message: 'ORGANIZATION_NAME_TOO_LONG' })
  @Matches(/^(?! )[A-Za-z]+( [A-Za-z]+)*(?<! )$/, {
    message: 'ORGANIZATION_NAME_CONTAINS_INVALID_CHARACTERS',
  })
  @Transform(({ value }) => value?.trim())
  orgName: string;

  @IsString({ message: 'COUNTRY_MUST_BE_STRING' })
  @IsNotEmpty({ message: 'COUNTRY_REQUIRED' })
  orgCountry: string;
}
