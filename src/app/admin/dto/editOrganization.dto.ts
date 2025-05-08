import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class EditOrganizationDto {
  @IsString({ message: 'ORGANIZATION_NAME_MUST_BE_STRING' })
  @IsNotEmpty({ message: 'ORGANIZATION_REQUIRED' })
  @MinLength(2, { message: 'ORGANIZATION_NAME_TOO_SHORT' })
  @MaxLength(50, { message: 'ORGANIZATION_NAME_TOO_LONG' })
  @Matches(/^(?! )[A-Za-z]+( [A-Za-z]+)*(?<! )$/, {
    message: 'ORGANIZATION_NAME_CONTAINS_INVALID_CHARACTERS',
  })
  @Transform(({ value }) => value?.trim())
  orgName: string;

  @IsOptional()
  orgImage?: Express.Multer.File;

  @IsOptional()
  @IsString({ message: 'ORGANIZATION_SUBDOMAIN_INVALID' })
  @Matches(/^[a-z0-9-]+$/, {
    message: 'ORGANIZATION_SUBDOMAIN_INVALID',
  })
  @Transform(({ value }) => value?.trim().toLowerCase())
  orgSubdomain?: string;

  @IsOptional()
  @IsString({ message: 'ORGANIZATION_COUNTRY_INVALID' })
  orgCountry?: string;
}
