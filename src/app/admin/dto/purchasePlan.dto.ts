import { BillingCycle } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsPositive, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class PurchasePlanDto {
  @IsNotEmpty({ message: 'ORGANIZATION_ID_NOT_EMPTY' })
  @IsUUID('4', { message: 'ORGANIZATION_ID_INVALID' })
  organizationId: string;

  @IsNotEmpty({ message: 'PLAN_ID_NOT_EMPTY' })
  @IsUUID('4', { message: 'PLAN_ID_INVALID' })
  planId: string;

  @IsInt({ message: 'MEMBER COUNT MUST BE AN INTEGER' })
  @IsPositive({ message: 'MEMBER COUNT MUST BE GREATER THAN ZERO' })
  @Type(() => Number)
  memberCount: string;

  @IsNumber({}, { message: 'TOTAL PRICE MUST BE A NUMBER' })
  @IsPositive({ message: 'TOTAL PRICE MUST BE GREATER THAN ZERO' })
  @Type(() => Number)
  totalPrice: string;

  @IsEnum(BillingCycle, { message: 'BILLING_CYCLE_INVALID' })
  billingCycle: BillingCycle;
}
