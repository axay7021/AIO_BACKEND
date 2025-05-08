import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches } from 'class-validator';

export class SubdomainCheckDto {
  @IsOptional()
  @IsString({ message: 'ORGANIZATION_SUBDOMAIN_INVALID' })
  @Matches(/^[a-z0-9-]+$/, {
    message: 'SUBDOMAIN_INVALID',
  })
  @Transform(({ value }) => value?.trim().toLowerCase())
  orgSubdomain?: string;
}
