import { IsEmail, IsNotEmpty, Matches } from 'class-validator';

export class ResendOtpDto {
  @IsNotEmpty({ message: 'EMAIL_REQUIRED' })
  @IsEmail({}, { message: 'EMAIL_INVALID' })
  @Matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$/, {
    message: 'EMAIL_INVALID_FORMAT',
  })
  email: string;
}
