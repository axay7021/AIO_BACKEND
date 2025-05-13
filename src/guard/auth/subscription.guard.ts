import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { Reflector } from '@nestjs/core';
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private prismaService: PrismaService,
    private reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    if (!user || !user.organizationId) {
      throw new BadRequestException('USER_AUTHENTICATION_REQUIRED');
    }

    return true;
  }
}
