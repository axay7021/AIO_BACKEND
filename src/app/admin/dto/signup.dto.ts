import { IsEmail, IsNotEmpty, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateAdminDto {
  // @IsNotEmpty({ message: 'FIRST_NAME_REQUIRED' })
  // @IsString({ message: 'FIRST_NAME_INVALID' })
  // @MinLength(1, { message: 'FIRST_NAME_TOO_SHORT' })
  // @MaxLength(20, { message: 'FIRST_NAME_TOO_LONG' })
  // firstName: string;

  // @IsNotEmpty({ message: 'LAST_NAME_REQUIRED' })
  // @IsString({ message: 'LAST_NAME_INVALID' })
  // @MinLength(1, { message: 'LAST_NAME_TOO_SHORT' })
  // @MaxLength(20, { message: 'LAST_NAME_TOO_LONG' })
  // lastName: string;

  @IsNotEmpty({ message: 'EMAIL_REQUIRED' })
  @IsEmail({}, { message: 'EMAIL_INVALID' })
  @Matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$/, {
    message: 'EMAIL_INVALID_FORMAT',
  })
  email: string;

  @IsNotEmpty({ message: 'PASSWORD_REQUIRED' })
  @MinLength(8, { message: 'PASSWORD_TOO_SHORT' })
  @MaxLength(20, { message: 'PASSWORD_TOO_LONG' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,20}$/, {
    message: 'PASSWORD_WEAK',
  })
  password: string;

  // @IsString({ message: 'COUNTRY_CODE_MUST_STRING' })
  // @IsNotEmpty({ message: 'COUNTRY_CODE_REQUIRED' })
  // countryCode: string;

  // @IsNotEmpty({ message: 'PHONE_NUMBER_REQUIRED' })
  // @IsString({ message: 'PHONE_NUMBER_MUST_STRING' })
  // @MaxLength(15, { message: 'PHONE_NUMBER_TOO_LONG' })
  // @Matches(/^[0-9]+$/, { message: 'PHONE_NUMBER_MUST_CONTAIN_ONLY_NUMBERS' })
  // phoneNumber: string;
}
