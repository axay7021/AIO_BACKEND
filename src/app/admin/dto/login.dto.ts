import { IsEmail, IsNotEmpty, Matches, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
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
}
