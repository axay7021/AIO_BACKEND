import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
export class CompleteProfileDto {
  @IsNotEmpty({ message: 'FIRST_NAME_REQUIRED' })
  @IsString({ message: 'FIRST_NAME_INVALID' })
  @MinLength(1, { message: 'FIRST_NAME_TOO_SHORT' })
  @MaxLength(20, { message: 'FIRST_NAME_TOO_LONG' })
  @Matches(/^[^\s\[\]":;'<,>.?]+$/, { message: 'FIRST_NAME_CONTAINS_INVALID_CHARACTERS' })
  firstName: string;

  @IsString({ message: 'LAST_NAME_INVALID' })
  @MinLength(1, { message: 'LAST_NAME_TOO_SHORT' })
  @MaxLength(20, { message: 'LAST_NAME_TOO_LONG' })
  @Matches(/^[^\s\[\]":;'<,>.?]+$/, { message: 'LAST_NAME_CONTAINS_INVALID_CHARACTERS' })
  @IsOptional()
  lastName: string;

  @IsString({ message: 'COUNTRY_CODE_MUST_STRING' })
  @IsNotEmpty({ message: 'COUNTRY_CODE_REQUIRED' })
  @Matches(/^[^\s\[\]":;'<,>.?]+$/, { message: 'COUNTRY_CODE_CONTAINS_INVALID_CHARACTERS' })
  countryCode: string;

  @IsNotEmpty({ message: 'PHONE_NUMBER_REQUIRED' })
  @IsString({ message: 'PHONE_NUMBER_MUST_STRING' })
  @MinLength(4, { message: 'PHONE_NUMBER_TOO_SHORT' })
  @MaxLength(15, { message: 'PHONE_NUMBER_TOO_LONG' })
  @Matches(/^[0-9]+$/, { message: 'PHONE_NUMBER_MUST_CONTAIN_ONLY_NUMBERS' })
  phoneNumber: string;
}
