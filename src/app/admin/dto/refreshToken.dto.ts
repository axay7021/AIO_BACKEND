import { IsIn, IsNotEmpty, IsString, Matches } from 'class-validator';
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\S+$/, {
    message: 'REFRESH_TOKEN_MUST_NOT_CONTAIN_WHITESPACE',
  })
  refreshToken: string;
}
