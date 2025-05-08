import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { SubscriptionGuard } from '../../guard/auth/subscription.guard';
import { PrismaService } from '../../common/services/prisma.service';
import { SubscriptionStatus } from '@prisma/client';
import { Reflector } from '@nestjs/core';

describe('SubscriptionGuard', () => {
  let guard: SubscriptionGuard;
  let prismaService: PrismaService;
  let mockExecutionContext: ExecutionContext;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionGuard,
        {
          provide: PrismaService,
          useValue: {
            organizationSubscription: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<SubscriptionGuard>(SubscriptionGuard);
    prismaService = module.get<PrismaService>(PrismaService);
    reflector = module.get<Reflector>(Reflector);

    // Mock execution context
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: {
            organizationId: '123',
          },
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should throw BadRequestException when user is not authenticated', async () => {
    const mockRequest = { user: null };
    jest.spyOn(mockExecutionContext.switchToHttp(), 'getRequest').mockReturnValue(mockRequest);

    await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
      'USER_AUTHENTICATION_REQUIRED',
    );
  });

  it('should throw BadRequestException when organization has no subscription', async () => {
    const mockRequest = { user: { organizationId: '123' } };
    jest.spyOn(mockExecutionContext.switchToHttp(), 'getRequest').mockReturnValue(mockRequest);
    jest.spyOn(prismaService.organizationSubscription, 'findUnique').mockResolvedValue(null);

    await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
      'ORGANIZATION_HAS_NO_ACTIVE_SUBSCRIPTION',
    );
  });

  it('should throw BadRequestException when subscription plan is inactive', async () => {
    const mockRequest = { user: { organizationId: '123' } };
    jest.spyOn(mockExecutionContext.switchToHttp(), 'getRequest').mockReturnValue(mockRequest);

    const mockSubscription = {
      status: SubscriptionStatus.ACTIVE,
      endDate: new Date(Date.now() + 86400000), // Future date
      planId: 'plan-123',
      plan: {
        isActive: false,
      },
    };

    prismaService.organizationSubscription.findUnique = jest
      .fn()
      .mockResolvedValue(mockSubscription);

    await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
      'SUBSCRIPTION_PLAN_IS_NO_LONGER_AVAILABLE',
    );
  });

  it('should throw BadRequestException when subscription status is invalid', async () => {
    const mockRequest = { user: { organizationId: '123' } };
    jest.spyOn(mockExecutionContext.switchToHttp(), 'getRequest').mockReturnValue(mockRequest);

    const mockSubscription = {
      status: SubscriptionStatus.SUSPENDED,
      endDate: new Date(Date.now() + 86400000), // Future date
      planId: 'plan-123',
      plan: {
        isActive: true,
      },
    };

    prismaService.organizationSubscription.findUnique = jest
      .fn()
      .mockResolvedValue(mockSubscription);

    await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
      `SUBSCRIPTION_IS_${SubscriptionStatus.SUSPENDED.toLowerCase()}`,
    );
  });

  it('should throw BadRequestException when subscription has expired', async () => {
    const mockRequest = { user: { organizationId: '123' } };
    jest.spyOn(mockExecutionContext.switchToHttp(), 'getRequest').mockReturnValue(mockRequest);

    const mockSubscription = {
      status: SubscriptionStatus.ACTIVE,
      endDate: new Date(Date.now() - 86400000), // Past date
      planId: 'plan-123',
      plan: {
        isActive: true,
      },
    };

    prismaService.organizationSubscription.findUnique = jest
      .fn()
      .mockResolvedValue(mockSubscription);
    reflector.get = jest.fn().mockReturnValue(false);

    await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
      'SUBSCRIPTION_HAS_EXPIRED',
    );
  });

  it('should return true when subscription is valid', async () => {
    const mockRequest = { user: { organizationId: '123' } };
    jest.spyOn(mockExecutionContext.switchToHttp(), 'getRequest').mockReturnValue(mockRequest);

    const mockSubscription = {
      status: SubscriptionStatus.ACTIVE,
      endDate: new Date(Date.now() + 86400000), // Future date
      planId: 'plan-123',
      plan: {
        isActive: true,
      },
    };

    prismaService.organizationSubscription.findUnique = jest
      .fn()
      .mockResolvedValue(mockSubscription);

    expect(await guard.canActivate(mockExecutionContext)).toBe(true);
  });
});
