import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from '../../app/admin/admin.service';
import { PrismaService } from 'src/common/services/prisma.service';
import { IPBlockingGuard } from 'src/guard/common/ip-blocking.guard';
import { EmailBlockingGuard } from 'src/guard/nonAuth/email-blocking.guard';
import { HashingService } from 'src/common/services/hashing.service';
import {
  BadRequestException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ECoreReq, ECoreReqAdmin, RequestUser } from '@common/interfaces/request.interface';
import { CreateAdminDto } from '../../app/admin/dto/signup.dto';
import { EmailService } from '@common/services/email.service';
import { TokenUtils } from '@common/services/jwt.service';
import { CloudinaryService } from '@common/services/clodinary.service';
import { JwtService } from '@nestjs/jwt';
import { VerifyOtpDto } from '@app/admin/dto/otpVerify.dto';
import { HttpStatus } from '@common/constants/httpStatus.constant';
import { ResendOtpDto } from '@app/admin/dto/resendOtp.dto';
import { CompleteProfileDto } from '@app/admin/dto/completeProfile.dto';
import { ForgotPasswordDto } from '@app/admin/dto/forgotPassword.dto';
import { EditProfileDto } from '@app/admin/dto/editProfile.dto';

describe('AdminService', () => {
  let adminService: AdminService;
  let prismaService: PrismaService;
  let ipBlockingGuard: IPBlockingGuard;
  let emailBlockingGuard: EmailBlockingGuard;
  let hashingService: HashingService;
  let emailService: EmailService;
  let jwtService: TokenUtils;
  let cloudinaryService: CloudinaryService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
              update: jest.fn(),
            },
            userOtp: {
              findUnique: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
            },
            organizationMember: {
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            organization: {
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            department: {
              create: jest.fn(),
            },
            departmentMember: {
              create: jest.fn(),
            },
            plan: {
              findMany: jest.fn(),
            },
            organizationSubscription: {
              findUnique: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            generateToken: jest.fn().mockResolvedValue('mocked-jwt-token'),
          },
        },
        {
          provide: IPBlockingGuard,
          useValue: {
            canActivate: jest.fn(),
            trackFailedAttempt: jest.fn().mockImplementation(() => Promise.resolve()),
            resetAttempts: jest.fn(),
          },
        },
        {
          provide: EmailBlockingGuard,
          useValue: {
            canActivate: jest.fn(),
            trackFailedAttempt: jest.fn(),
            resetAttempts: jest.fn(),
          },
        },
        {
          provide: HashingService,
          useValue: {
            hashPassword: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendOtpToMail: jest.fn(),
          },
        },
        {
          provide: TokenUtils,
          useValue: {
            generateToken: jest.fn(),
            generateSubdomainToken: jest.fn(),
          },
        },
        {
          provide: CloudinaryService,
          useValue: {
            uploadImage: jest.fn(),
            deleteImage: jest.fn(),
          },
        },
      ],
    }).compile();

    adminService = module.get<AdminService>(AdminService);
    prismaService = module.get<PrismaService>(PrismaService);
    ipBlockingGuard = module.get<IPBlockingGuard>(IPBlockingGuard);
    emailBlockingGuard = module.get<EmailBlockingGuard>(EmailBlockingGuard);
    hashingService = module.get<HashingService>(HashingService);
    emailService = module.get<EmailService>(EmailService);
    jwtService = module.get<TokenUtils>(TokenUtils);
    cloudinaryService = module.get<CloudinaryService>(CloudinaryService);
  });

  afterEach(() => {
    jest.clearAllMocks(); // Reset all mocks after each test
  });

  it('should be defined', () => {
    expect(adminService).toBeDefined();
  });

  describe('createAdmin', () => {
    const mockRequest: Partial<ECoreReq> = {
      ip: '127.0.0.1',
    };

    const mockCreateAdminDto: CreateAdminDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    // it('should throw error if email already exists', async () => {
    //   // Mock existing user based on the current schema
    //   jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce({
    //     id: 'uuid-1234',
    //     email: 'test@example.com',
    //     // password: 'encrypted_password',
    //     // firstName: null,
    //     // lastName: null,
    //     // countryCode: null,
    //     // phoneNumber: null,
    //     // authProvider: 'EMAIL',
    //     // googleId: null,
    //     // profileImageUrl: null,
    //     // profileImageKey: null,
    //     // status: 'ACTIVE',
    //     // emailVerified: false,
    //     // createdAt: new Date(),
    //     // updatedAt: new Date(),
    //     // lastLoginAt: null,
    //     // deleted: false,
    //     // language: 'EN',
    //     // timeZone: 'AmericaNew_York',
    //     // isPasswordReset: false,
    //   });

    //   // Expect the signup to throw HttpException with status 402
    //   await expect(
    //     adminService.createAdmin(mockRequest as ECoreReqAdmin, mockCreateAdminDto),
    //   ).rejects.toThrow(
    //     new HttpException(
    //       {
    //         message: 'EMAIL_ALREADY_EXISTS',
    //         statusCode: 402,
    //       },
    //       402,
    //     ),
    //   );

    //   // Verify the findUnique call
    //   expect(prismaService.user.findUnique).toHaveBeenCalledWith({
    //     where: {
    //       email: mockCreateAdminDto.email.trim().toLowerCase(),
    //       deleted: false,
    //     },
    //   });

    //   // Verify blocking guards were called
    //   expect(ipBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(mockRequest.ip);
    //   expect(emailBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(
    //     mockCreateAdminDto.email.trim().toLowerCase(),
    //   );
    // });

    it('should successfully create a new user', async () => {
      // Mock email check
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce(null);

      // Mock password hashing
      jest.spyOn(hashingService, 'hashPassword').mockResolvedValueOnce('hashedPassword');

      // Mock transaction
      jest.spyOn(prismaService, '$transaction').mockImplementationOnce(async () => {
        const mockUser = {
          id: 'uuid-1234',
          email: mockCreateAdminDto.email.trim().toLowerCase(),
          password: 'hashedPassword',
          authProvider: 'EMAIL',
        };

        const mockUserOtp = {
          id: 'otp-uuid-1234',
          userId: 'uuid-1234',
          crmOtp: expect.any(Number),
          otpExpireTime: new Date(Date.now() + 5 * 60000),
          nextOtpTime: new Date(Date.now() + 30000),
        };

        return { user: mockUser, userOtp: mockUserOtp };
      });

      // Mock email service
      // jest.spyOn(emailService, 'sendOtpToMail').mockResolvedValueOnce(true);

      // Execute signup
      const result = await adminService.createAdmin(
        mockRequest as ECoreReqAdmin,
        mockCreateAdminDto,
      );

      // Verify email check
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: {
          email: mockCreateAdminDto.email.trim().toLowerCase(),
          deleted: false,
        },
      });

      // Verify password hashing
      expect(hashingService.hashPassword).toHaveBeenCalledWith(mockCreateAdminDto.password);

      // Verify transaction call with correct data structure
      expect(prismaService.$transaction).toHaveBeenCalled();

      // Verify email service was called with correct parameters
      // expect(emailService.sendOtpToMail).toHaveBeenCalledWith(
      //   mockCreateAdminDto.email.trim().toLowerCase(),
      //   { otp: expect.any(Number) }
      // );

      // Verify response matches service implementation
      expect(result).toEqual({
        email: mockCreateAdminDto.email.trim().toLowerCase(),
        otp: expect.any(String),
      });
    });
  });

  describe('verify-otp', () => {
    const mockRequest: Partial<ECoreReq> = {
      ip: '127.0.0.1',
    };

    const mockVerifyOtp: VerifyOtpDto = {
      email: 'test@example.com',
      otp: '123456',
    };

    it('should successfully verify OTP for a normal user', async () => {
      // Arrange
      const currentDate = new Date();
      const futureDate = new Date(currentDate.getTime() + 5 * 60000); // 10 minutes in the future
      const nextOtpTime = new Date(currentDate.getTime() + 30 * 1000);

      const mockUser = {
        id: 'user-123',
        password: 'hashed-password',
        emailVerified: false,
        isPasswordReset: false,
        otps: [
          {
            id: 'otp-123',
            crmOtp: 123456,
            otpExpireTime: futureDate,
            nextOtpTime: nextOtpTime,
          },
        ],
      };

      prismaService.user.findUnique = jest.fn().mockResolvedValue(mockUser);
      prismaService.user.update = jest.fn().mockResolvedValue({
        ...mockUser,
        emailVerified: true,
      });

      jwtService.generateToken = jest.fn().mockResolvedValue('mock-jwt-token');
      // Act
      const result = await adminService.verifyOtp(mockRequest as ECoreReq, mockVerifyOtp);

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: mockVerifyOtp.email.toLowerCase().trim() },
        select: {
          id: true,
          password: true,
          emailVerified: true,
          isPasswordReset: true,
          otps: {
            select: {
              id: true,
              crmOtp: true,
              otpExpireTime: true,
              nextOtpTime: true,
            },
          },
        },
      });

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          emailVerified: true,
        },
      });

      expect(jwtService.generateToken).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({
        token: 'mock-jwt-token',
        _statusCode: HttpStatus.ACCEPTED,
      });
    });

    it('should successfully verify OTP for password reset', async () => {
      // Arrange
      const currentDate = new Date();
      const futureDate = new Date(currentDate.getTime() + 10 * 60000); // 10 minutes in the future

      const mockUser = {
        id: 'user-123',
        password: 'hashed-password',
        emailVerified: true,
        isPasswordReset: true,
        otps: [
          {
            id: 'otp-123',
            crmOtp: 123456,
            otpExpireTime: futureDate,
            nextOtpTime: null,
          },
        ],
      };

      prismaService.user.findUnique = jest.fn().mockResolvedValue(mockUser);
      jwtService.generateToken = jest.fn().mockResolvedValue('mock-jwt-token');

      // Act
      const result = await adminService.verifyOtp(mockRequest as ECoreReq, mockVerifyOtp);

      // Assert
      // expect(prismaService.user.update).toHaveBeenCalledWith({
      //   where: { id: 'user-123' },
      //   data: {
      //     isPasswordReset: false,
      //   },
      // });

      expect(result).toEqual({
        token: 'mock-jwt-token',
        _statusCode: HttpStatus.RESET_CONTENT,
      });
    });

    it('should throw NotFoundException when user is not found', async () => {
      // Arrange
      prismaService.user.findUnique = jest.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(adminService.verifyOtp(mockRequest as ECoreReq, mockVerifyOtp)).rejects.toThrow(
        new NotFoundException({
          message: 'INVALID_EMAIL_OR_PASSWORD',
        }),
      );

      expect(ipBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(mockRequest.ip);
      expect(emailBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(mockVerifyOtp.email);
    });

    it('should throw BadRequestException when OTP is invalid', async () => {
      // Arrange
      const mockUser = {
        id: 'user-123',
        password: 'hashed-password',
        emailVerified: false,
        isPasswordReset: false,
        otps: [
          {
            id: 'otp-123',
            crmOtp: 111111, // Different from provided OTP
            otpExpireTime: new Date(Date.now() + 60000),
            nextOtpTime: null,
          },
        ],
      };

      prismaService.user.findUnique = jest.fn().mockResolvedValue(mockUser);

      // Act & Assert
      await expect(adminService.verifyOtp(mockRequest as ECoreReq, mockVerifyOtp)).rejects.toThrow(
        new BadRequestException({
          message: 'INVALID_OTP',
          data: { email: mockVerifyOtp.email },
        }),
      );

      expect(ipBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(mockRequest.ip);
      expect(emailBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(mockVerifyOtp.email);
    });

    it('should throw BadRequestException when OTP has expired', async () => {
      // Arrange
      const pastDate = new Date(Date.now() - 10000); // 10 seconds in the past

      const mockUser = {
        id: 'user-123',
        password: 'hashed-password',
        emailVerified: false,
        isPasswordReset: false,
        otps: [
          {
            id: 'otp-123',
            crmOtp: 123456,
            otpExpireTime: pastDate, // Expired
            nextOtpTime: null,
          },
        ],
      };

      prismaService.user.findUnique = jest.fn().mockResolvedValue(mockUser);

      // Act & Assert
      await expect(adminService.verifyOtp(mockRequest as ECoreReq, mockVerifyOtp)).rejects.toThrow(
        new BadRequestException({
          message: 'OTP_EXPIRED',
          data: { email: mockVerifyOtp.email },
        }),
      );
    });

    it('should throw BadRequestException when OTP is missing', async () => {
      // Arrange
      const mockUser = {
        id: 'user-123',
        password: 'hashed-password',
        emailVerified: false,
        isPasswordReset: false,
        otps: [], // No OTPs found
      };

      prismaService.user.findUnique = jest.fn().mockResolvedValue(mockUser);

      // Act & Assert
      await expect(adminService.verifyOtp(mockRequest as ECoreReq, mockVerifyOtp)).rejects.toThrow(
        new BadRequestException({
          message: 'INVALID_OTP',
          data: { email: mockVerifyOtp.email },
        }),
      );

      expect(ipBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(mockRequest.ip);
      expect(emailBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(mockVerifyOtp.email);
    });
  });

  describe('resend-otp', () => {
    const mockRequest: Partial<ECoreReq> = {
      ip: '127.0.0.1',
    };

    const mockResendOtp: ResendOtpDto = {
      email: 'test@example.com',
    };

    it('should successfully resend OTP when no cooldown restrictions', async () => {
      // Arrange
      const userId = 'user-123';
      const otpId = 'otp-123';
      const currentDate = new Date();
      const pastDate = new Date(currentDate.getTime() - 10000); // 10 seconds in the past

      const mockUser = {
        id: userId,
        emailVerified: false,
        otps: [
          {
            id: otpId,
            crmOtp: expect.any(Number),
            otpExpireTime: pastDate,
            nextOtpTime: pastDate,
          },
        ],
      };

      prismaService.user.findUnique = jest.fn().mockResolvedValue(mockUser);
      // Mock email service
      // Act
      const result = await adminService.resendOtp(mockRequest as ECoreReq, mockResendOtp);

      jest.spyOn(emailService, 'sendOtpToMail').mockResolvedValueOnce(true);
      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: {
          email: mockResendOtp.email.toLowerCase().trim(),
        },
        select: {
          id: true,
          emailVerified: true,
        },
      });

      expect(emailService.sendOtpToMail).toHaveBeenCalledWith(mockResendOtp.email, {
        otp: expect.any(Number),
      });
      expect(result).toBe(true);
    });

    it('should throw BadRequestException when user email is not found', async () => {
      // Arrange
      prismaService.user.findUnique = jest.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(adminService.resendOtp(mockRequest as ECoreReq, mockResendOtp)).rejects.toThrow(
        new BadRequestException({
          message: 'INVALID_EMAIL_OR_PASSWORD',
          data: { email: mockResendOtp.email },
        }),
      );

      expect(ipBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(mockRequest.ip);
      expect(emailBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(mockResendOtp.email);
    });

    it('should throw BadRequestException when in cooldown period', async () => {
      // Arrange
      const userId = 'user-123';
      const otpId = 'otp-123';
      const currentDate = new Date();
      const futureDate = new Date(currentDate.getTime() + 20000); // 20 seconds in the future

      const mockUser = {
        id: userId,
        emailVerified: false,
        otps: [
          {
            id: otpId,
            crmOtp: 111111,
            otpExpireTime: futureDate,
            nextOtpTime: futureDate, // Next OTP time is in the future, so it's in cooldown
          },
        ],
      };

      prismaService.user.findUnique = jest.fn().mockResolvedValue(mockUser);

      // Act & Assert
      await expect(adminService.resendOtp(mockRequest as ECoreReq, mockResendOtp)).rejects.toThrow(
        new BadRequestException({
          message: 'OTP_COOLDOWN_TIME',
        }),
      );

      expect(ipBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(mockRequest.ip);
      expect(emailBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(mockResendOtp.email);
    });
  });

  describe('verify-token', () => {
    const userId = 'test-user-id';

    it('should return true for a user with complete profile and active subscription', async () => {
      // Arrange
      const mockUser = {
        id: userId,
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: '1234567890',
        organizationMembers: [
          {
            organization: {
              id: 'org-1',
              name: 'Test Org',
              subscription: {
                id: 'sub-1',
                status: 'ACTIVE',
              },
            },
          },
        ],
      };

      prismaService.user.findUnique = jest.fn().mockResolvedValue(mockUser);

      // Act
      const result = await adminService.verifyToken(userId);

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        include: {
          organizationMembers: {
            include: {
              organization: {
                include: {
                  subscription: true,
                },
              },
            },
          },
        },
      });
      expect(result).toBe(true);
    });

    it('should throw NotFoundException when user is not found', async () => {
      // Arrange
      prismaService.user.findUnique = jest.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(adminService.verifyToken(userId)).rejects.toThrow(
        new NotFoundException({
          message: 'INVALID_EMAIL_OR_PASSWORD',
        }),
      );
    });

    it('should throw HttpException with INCOMPLETE_PROFILE when firstName, lastName and mobileNumber is missing', async () => {
      // Arrange
      const mockUser = {
        id: userId,
        firstName: null, // Missing firstName
        lastName: null,
        phoneNumber: null,
        organizationMembers: [
          {
            organization: {
              id: 'org-1',
              name: 'Test Org',
              subscription: {
                id: 'sub-1',
                status: 'ACTIVE',
              },
            },
          },
        ],
      };

      prismaService.user.findUnique = jest.fn().mockResolvedValue(mockUser);

      // Act & Assert
      await expect(adminService.verifyToken(userId)).rejects.toThrow(
        new HttpException(
          {
            message: 'INCOMPLETE_PROFILE',
          },
          HttpStatus.ACCEPTED,
        ),
      );
    });

    it('should throw HttpException when user has no organizations', async () => {
      // Arrange
      const mockUser = {
        id: userId,
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: '1234567890',
        organizationMembers: [], // Empty array - no organizations
      };

      prismaService.user.findUnique = jest.fn().mockResolvedValue(mockUser);

      // Act & Assert
      await expect(adminService.verifyToken(userId)).rejects.toThrow(
        new HttpException(
          {
            message: 'USER_NOT_ASSOCIATED_WITH_ANY_ORGANIZATION',
          },
          203,
        ),
      );
    });

    it('should throw HttpException when user has organizations but no subscription', async () => {
      // Arrange
      const mockUser = {
        id: userId,
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: '1234567890',
        organizationMembers: [
          {
            userType: 'WORKER', // Not an owner, so we'll get USER_PLAN_DEACTIVATED
            organization: {
              id: 'org-1',
              name: 'Test Org',
              subscription: null, // No subscription
            },
          },
        ],
      };

      prismaService.user.findUnique = jest.fn().mockResolvedValue(mockUser);
      jwtService.generateToken = jest.fn().mockResolvedValue('mock-token');

      // Act & Assert
      await expect(adminService.verifyToken(userId)).rejects.toThrow(
        new HttpException(
          {
            message: 'USER_PLAN_DEACTIVATED',
            statusCode: 400,
          },
          400,
        ),
      );
    });
  });

  describe('complete-profile', () => {
    const userId = 'test-user-id';
    it('should successfully update all profile fields', async () => {
      // Arrange
      const mockUser = {
        id: userId,
        firstName: null,
        lastName: null,
        countryCode: null,
        phoneNumber: null,
        email: 'test@example.com',
      };

      const completeProfileDto: CompleteProfileDto = {
        firstName: 'NewFirst',
        lastName: 'NewLast',
        countryCode: '+91',
        phoneNumber: '9876543210',
      };

      prismaService.user.findUnique = jest.fn().mockResolvedValue(mockUser);
      prismaService.user.update = jest.fn().mockResolvedValue({
        ...mockUser,
        ...completeProfileDto,
      });

      // Act
      const result = await adminService.completeProfile(userId, completeProfileDto);

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          firstName: completeProfileDto.firstName,
          lastName: completeProfileDto.lastName,
          countryCode: completeProfileDto.countryCode,
          phoneNumber: completeProfileDto.phoneNumber,
        },
      });

      expect(result).toBe(true);
    });

    it('should throw NotFoundException when user is not found', async () => {
      // Arrange
      prismaService.user.findUnique = jest.fn().mockResolvedValue(null);

      const completeProfileDto: CompleteProfileDto = {
        firstName: 'NewFirst',
        lastName: 'NewLast',
        countryCode: '+91',
        phoneNumber: '9876543210',
      };

      // Act & Assert
      await expect(adminService.completeProfile(userId, completeProfileDto)).rejects.toThrow(
        new NotFoundException({
          message: 'INVALID_EMAIL_OR_PASSWORD',
        }),
      );

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });
  });

  describe('get-profile-detail', () => {
    const user = {
      userId: 'user-123',
      organizationId: 'org-123',
      userType: 'OWNER',
      adminRole: 'ADMIN',
      platform: 'WEBSITE',
    };
    it('should throw when user is not found', () => {
      // Arrange
      prismaService.user.findFirst = jest.fn().mockResolvedValue(null);

      // Act and asssert
      expect(adminService.getProfileDetail(user as unknown as RequestUser)).rejects.toThrow(
        new UnauthorizedException('USER_NOT_FOUND'),
      );
    });
  });

  describe('/edit-profile-detail', () => {
    const user = {
      userId: 'user-123',
      organizationId: 'org-123',
      userType: 'OWNER',
      adminRole: 'ADMIN',
      platform: 'WEBSITE',
    };

    const body: EditProfileDto = {
      firstName: 'Test',
      lastName: 'User',
      countryCode: '+91',
      phoneNumber: '1234567890',
    };

    const mockFile = {
      path: expect.any(String),
    } as Express.Multer.File;

    const mockUser = {
      id: user.userId,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phoneNumber: '1234567890',
      countryCode: '+1',
      profileImageKey: 'old-image-key',
      profileImageUrl: 'https://example.com/old-image.jpg',
    };

    it('should throw error when user is not found', () => {
      // Arrange
      prismaService.user.findUnique = jest.fn().mockResolvedValue(null);

      // Act and assert
      expect(
        adminService.editProfile(user as unknown as RequestUser, body, mockFile),
      ).rejects.toThrow(new BadRequestException('USER_NOT_FOUND'));
    });

    it('should update profile without image', async () => {
      // Arrange
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        countryCode: '+91',
        phoneNumber: '1234567890',
      };

      prismaService.user.findUnique = jest.fn().mockResolvedValue(mockUser);
      prismaService.user.update = jest.fn().mockResolvedValue({
        ...mockUser,
        ...updateData,
      });

      // Act
      const result = await adminService.editProfile(
        user as unknown as RequestUser,
        updateData,
        null,
      );

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: user.userId },
      });

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: user.userId },
        data: {
          firstName: updateData.firstName,
          lastName: updateData.lastName,
          phoneNumber: body.phoneNumber,
          countryCode: body.countryCode,
          profileImageKey: mockUser.profileImageKey,
          profileImageUrl: mockUser.profileImageUrl,
        },
      });

      expect(result).toEqual({
        userId: user.userId,
        firstName: updateData.firstName,
        lastName: updateData.lastName,
        phoneNumber: updateData.phoneNumber,
        profileImage: mockUser.profileImageUrl,
        countryCode: updateData.countryCode,
      });

      expect(cloudinaryService.uploadImage).not.toHaveBeenCalled();
      expect(cloudinaryService.deleteImage).not.toHaveBeenCalled();
    });
  });
});
