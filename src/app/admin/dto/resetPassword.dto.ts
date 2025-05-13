import { IsNotEmpty, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsNotEmpty({ message: 'PASSWORD_REQUIRED' })
  @MinLength(8, { message: 'PASSWORD_TOO_SHORT' })
  @MaxLength(20, { message: 'PASSWORD_TOO_LONG' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,20}$/, {
    message: 'PASSWORD_WEAK',
  })
  password: string;
}
