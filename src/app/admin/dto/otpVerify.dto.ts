import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsNotEmpty({ message: 'EMAIL_REQUIRED' })
  @IsEmail({}, { message: 'EMAIL_INVALID' })
  @Matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$/, {
    message: 'EMAIL_INVALID_FORMAT',
  })
  email: string;

  @IsNotEmpty({ message: 'OTP_REQUIRED' })
  @IsString({ message: 'OTP_MUST_STRING' })
  @Length(6, 6, { message: 'OTP_MUST_BE_SIX_DIGIT' })
  @Matches(/^[0-9]+$/, { message: 'OTP_CONTAIN_NUMBER' })
  otp: string;
}
