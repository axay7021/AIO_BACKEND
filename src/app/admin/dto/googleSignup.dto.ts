import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class GoogleSignupDto {
  @IsString({ message: 'TOKEN_MUST_BE_STRING' })
  @IsNotEmpty({ message: 'TOKEN_REQUIRED' })
  @Matches(/^\S+$/, {
    message: 'TOKEN_MUST_NOT_CONTAIN_WHITESPACE',
  })
  token: string;
}
