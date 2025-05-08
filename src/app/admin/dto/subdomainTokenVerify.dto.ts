import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class VerifySubdomainTokenDto {
  @IsNotEmpty({ message: 'SUBDOMAIN_TOKEN_REQUIRED' })
  @IsString({ message: 'SUBDOMAIN_TOKEN_MUST_BE_STRING' })
  @Matches(/\S/, { message: 'SUBDOMAIN_TOKEN_NO_WHITESPACE' })
  @Transform(({ value }) => value.trim())
  token: string;
}
