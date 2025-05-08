import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { FeatureType, SubscriptionStatus } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import { FeatureNames } from '@common/enums/feature-names.enum';
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private prismaService: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    if (!user || !user.organizationId) {
      throw new BadRequestException('USER_AUTHENTICATION_REQUIRED');
    }

    // 1. Verify organization subscription status
    const subscription = await this.prismaService.organizationSubscription.findUnique({
      where: {
        organizationId: user.organizationId,
      },
      select: {
        status: true,
        endDate: true,
        planId: true,
        plan: {
          select: {
            isActive: true,
            planFeatures: true,
          },
        },
      },
    });

    // Check if subscription exists
    if (!subscription) {
      throw new BadRequestException('ORGANIZATION_HAS_NO_ACTIVE_SUBSCRIPTION');
    }

    // 2. Check if the subscription plan is active
    if (!subscription.plan.isActive) {
      throw new BadRequestException('SUBSCRIPTION_PLAN_IS_NO_LONGER_AVAILABLE');
    }

    // 3. Check subscription status
    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException(`SUBSCRIPTION_IS_${subscription.status.toLowerCase()}`);
    }

    // 4. Check if subscription has expired
    const currentDate = new Date();
    if (currentDate > subscription.endDate) {
      throw new BadRequestException('SUBSCRIPTION_HAS_EXPIRED');
    }

    // 5. Check if the user has access to the required feature
    const requiredFeature = this.reflector.get<FeatureNames>(
      'requiredFeature',
      context.getHandler(),
    );
    console.log({ requiredFeature });
    if (requiredFeature) {
      const feature = subscription.plan.planFeatures.find(f => f.featureName === requiredFeature);

      if (!feature || !feature.isEnabled) {
        throw new BadRequestException('FEATURE_NOT_AVAILABLE_IN_CURRENT_PLAN');
      }
    }

    return true;
  }
}
