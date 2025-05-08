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
import { ECoreReq, RequestUser } from '@common/interfaces/request.interface';
import { CreateAdminDto } from '../../app/admin/dto/signup.dto';
import { EmailService } from '@common/services/email.service';
import { TokenUtils } from '@common/services/jwt.service';
import { CloudinaryService } from '@common/services/clodinary.service';
import { GoogleSignupDto } from '@app/admin/dto/googleSignup.dto';
import { JwtService } from '@nestjs/jwt';
import { VerifyOtpDto } from '@app/admin/dto/otpVerify.dto';
import { HttpStatus } from '@common/constants/httpStatus.constant';
import { ResendOtpDto } from '@app/admin/dto/resendOtp.dto';
import { CompleteProfileDto } from '@app/admin/dto/completeProfile.dto';
import { AdminRole, UserType, WorkerRole } from '@prisma/client';
import { ForgotPasswordDto } from '@app/admin/dto/forgotPassword.dto';
import { ResetPasswordDto } from '@app/admin/dto/resetPassword.dto';
import { GetPlanDetailsResponse } from '@common/interfaces/admin/admin.interface';
import { LoginDto } from '@app/admin/dto/login.dto';
import { Platform } from '@common/constants/prisma.constant';
import { GoogleSigninDto } from '@app/admin/dto/googleSignin.dto';
import { EditOrganizationDto } from '@app/admin/dto/editOrganization.dto';
import { EditProfileDto } from '@app/admin/dto/editProfile.dto';
import { OrganizationNameCheckDto } from '@app/admin/dto/organizationNameCheck.dto';

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

  describe('signup', () => {
    const mockRequest: Partial<ECoreReq> = {
      ip: '127.0.0.1',
    };

    const mockCreateAdminDto: CreateAdminDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should throw error if email already exists', async () => {
      // Mock existing user based on the current schema
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce({
        id: 'uuid-1234',
        email: 'test@example.com',
        password: 'encrypted_password',
        firstName: null,
        lastName: null,
        countryCode: null,
        phoneNumber: null,
        authProvider: 'EMAIL',
        googleId: null,
        profileImageUrl: null,
        profileImageKey: null,
        status: 'ACTIVE',
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
        deleted: false,
        language: 'EN',
        timeZone: 'AmericaNew_York',
        isPasswordReset: false,
      });

      // Expect the signup to throw HttpException with status 402
      await expect(
        adminService.signup(mockRequest as ECoreReq, mockCreateAdminDto),
      ).rejects.toThrow(
        new HttpException(
          {
            message: 'EMAIL_ALREADY_EXISTS',
            statusCode: 402,
          },
          402,
        ),
      );

      // Verify the findUnique call
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: {
          email: mockCreateAdminDto.email.trim().toLowerCase(),
          deleted: false,
        },
      });

      // Verify blocking guards were called
      expect(ipBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(mockRequest.ip);
      expect(emailBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(
        mockCreateAdminDto.email.trim().toLowerCase(),
      );
    });

    it('should successfully create a new user', async () => {
      // Mock email check
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce(null);

      // Mock password hashing
      jest.spyOn(hashingService, 'hashPassword').mockResolvedValueOnce('hashedPassword');

      // Mock transaction
      jest.spyOn(prismaService, '$transaction').mockImplementationOnce(async callback => {
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
      const result = await adminService.signup(mockRequest as ECoreReq, mockCreateAdminDto);

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

  describe('google/signup', () => {
    const mockRequest: Partial<ECoreReq> = {
      ip: '127.0.0.1',
    };

    const mockGoogleSignup: GoogleSignupDto = {
      token: expect.any(String),
    };

    const mockGooglePayload = {
      email: 'test@example.com',
      email_verified: true,
      given_name: 'John',
      family_name: 'Doe',
      sub: 'google123',
    };

    it('should create a new user when user does not exist', async () => {
      // Arrange
      adminService.verifyGoogleToken = jest.fn().mockResolvedValue(mockGooglePayload);
      prismaService.user.findUnique = jest.fn().mockResolvedValue(null);
      prismaService.user.create = jest.fn().mockResolvedValue({
        id: expect.any(String),
        email: mockGooglePayload.email,
        firstName: mockGooglePayload.given_name,
        lastName: mockGooglePayload.family_name,
      });

      jwtService.generateToken = jest.fn().mockResolvedValue('mock-jwt-token');
      // Act
      const result = await adminService.googleSignup(mockGoogleSignup);

      // Assert
      expect(adminService.verifyGoogleToken).toHaveBeenCalledWith(mockGoogleSignup.token);
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: mockGooglePayload.email,
          firstName: mockGooglePayload.given_name,
          lastName: mockGooglePayload.family_name,
          googleId: mockGooglePayload.sub,
          authProvider: 'GOOGLE',
          emailVerified: mockGooglePayload.email_verified,
        },
      });
      expect(result).toEqual({
        token: 'mock-jwt-token',
        email: mockGooglePayload.email,
        firstName: mockGooglePayload.given_name,
        lastName: mockGooglePayload.family_name,
      });
    });

    it('should throw exception when user exists but has no organization', async () => {
      // Arrange
      const existingUser = {
        id: expect.any(String),
        email: mockGooglePayload.email,
        authProvider: 'EMAIL',
        googleId: null,
        emailVerified: false,
        firstName: 'John',
        lastName: 'Doe',
        organizationMembers: [], // Empty array indicates no organizations
      };

      const errorToThrow = new HttpException(
        {
          message: 'USER_NOT_ASSOCIATED_WITH_ANY_ORGANIZATION',
          statusCode: 203,
          data: {
            token: 'mock-token',
          },
        },
        203,
      );

      adminService.verifyGoogleToken = jest.fn().mockResolvedValue(mockGooglePayload);
      prismaService.user.findUnique = jest.fn().mockResolvedValue(existingUser);
      prismaService.user.update = jest.fn().mockResolvedValue(existingUser);

      // Mock validateUserStatus to throw the expected error
      adminService.validateUserStatus = jest.fn().mockImplementation(() => {
        throw errorToThrow;
      });

      jwtService.generateToken = jest.fn().mockResolvedValue('mock-token');

      // Act & Assert
      await expect(adminService.googleSignup(mockGoogleSignup)).rejects.toThrow(errorToThrow);

      // Verify Google ID and email verification were updated
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: existingUser.id },
        data: {
          googleId: mockGooglePayload.sub,
          emailVerified: true,
        },
      });

      // Verify validateUserStatus was called
      expect(adminService.validateUserStatus).toHaveBeenCalledWith(existingUser.id);
    });

    it('should throw exception when user exists with organization but no plan', async () => {
      // Arrange
      const existingUser = {
        id: expect.any(String),
        email: mockGooglePayload.email,
        authProvider: 'EMAIL',
        googleId: null,
        emailVerified: false,
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: '1234567890', // Complete profile
        organizationMembers: [
          {
            organization: {
              id: 1,
              isActive: true,
              subscription: null, // No subscription plan
            },
          },
        ],
      };

      const errorToThrow = new HttpException(
        {
          message: 'USER_NOT_TAKEN_ANY_PLAN',
          statusCode: 206,
          data: {
            organizationId: 1,
            token: 'mock-token',
          },
        },
        206,
      );

      adminService.verifyGoogleToken = jest.fn().mockResolvedValue(mockGooglePayload);
      prismaService.user.findUnique = jest.fn().mockResolvedValue(existingUser);
      prismaService.user.update = jest.fn().mockResolvedValue(existingUser);

      // Mock validateUserStatus to throw the expected error
      adminService.validateUserStatus = jest.fn().mockImplementation(() => {
        throw errorToThrow;
      });

      jwtService.generateToken = jest.fn().mockResolvedValue('mock-token');

      // Act & Assert
      await expect(adminService.googleSignup(mockGoogleSignup)).rejects.toThrow(errorToThrow);

      // Verify Google ID and email verification were updated
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: existingUser.id },
        data: {
          googleId: mockGooglePayload.sub,
          emailVerified: true,
        },
      });
    });

    it('should return subdomain token when user already exists with organization and subscription', async () => {
      // Arrange
      const existingUser = {
        id: 'user-id',
        email: mockGooglePayload.email,
        authProvider: 'EMAIL',
        googleId: null,
        emailVerified: false,
        firstName: 'John',
        lastName: 'Doe',
        password: null,
        organizationMembers: [
          {
            organization: {
              id: 'org-id',
              isActive: true,
              subscription: { id: 1 }, // Has subscription
              name: 'Test Organization',
              subdomain: 'test-org',
            },
          },
        ],
      };

      // Mock the verifyGoogleToken method
      adminService.verifyGoogleToken = jest.fn().mockResolvedValue(mockGooglePayload);

      // Mock the user.findUnique method to return the existing user
      prismaService.user.findUnique = jest.fn().mockResolvedValue(existingUser);

      // Mock the user.update method
      prismaService.user.update = jest.fn().mockResolvedValue({
        ...existingUser,
        googleId: mockGooglePayload.sub,
        emailVerified: true,
      });

      // Mock the validateUserStatus method
      adminService.validateUserStatus = jest.fn().mockResolvedValue(true);

      // Mock getDefaultOrganization
      const mockOrgMember = {
        organization: {
          id: 'org-id',
          name: 'Test Organization',
          subdomain: 'test-org',
          subscription: {
            plan: {
              id: 'plan-id',
            },
          },
        },
      };
      adminService.getDefaultOrganization = jest.fn().mockResolvedValue(mockOrgMember);

      // Mock the organizationMember.update method
      prismaService.organizationMember.update = jest.fn().mockImplementation(({ data }) => ({
        userId: existingUser.id,
        organizationId: mockOrgMember.organization.id,
        accessTokenCRMId: null,
        refreshTokenCRMId: data.refreshTokenCRMId,
      }));

      // Mock the JWT subdomain token generation
      const mockSubdomainToken = 'mock-subdomain-token';
      jwtService.generateSubdomainToken = jest.fn().mockResolvedValue(mockSubdomainToken);

      // Act
      const result = await adminService.googleSignup(mockGoogleSignup);

      // Assert
      expect(result).toEqual({
        subdomainToken: expect.any(String),
        organizationSubdomain: 'test-org',
      });

      // Verify Google token verification
      expect(adminService.verifyGoogleToken).toHaveBeenCalledWith(mockGoogleSignup.token);

      // Verify user update with Google ID and email verification
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: existingUser.id },
        data: {
          googleId: mockGooglePayload.sub,
          emailVerified: true,
        },
      });

      // Verify organization member update - use toHaveBeenCalledWith instead of accessing mock.calls
      expect(prismaService.organizationMember.update).toHaveBeenCalledWith({
        where: {
          userId_organizationId: {
            userId: existingUser.id,
            organizationId: mockOrgMember.organization.id,
          },
        },
        data: {
          accessTokenCRMId: null,
          refreshTokenCRMId: expect.any(String),
        },
      });

      // Verify subdomain token generation - use toHaveBeenCalledWith instead of accessing mock.calls
      expect(jwtService.generateSubdomainToken).toHaveBeenCalledWith(
        existingUser.id,
        mockOrgMember.organization.id,
        expect.any(String),
      );
    });

    it('should throw exception when google token is expired', async () => {
      // Arrange
      adminService.verifyGoogleToken = jest
        .fn()
        .mockRejectedValue(new UnauthorizedException('GOOGLE_TOKEN_EXPIRED'));

      // Act & Assert
      await expect(adminService.googleSignup(mockGoogleSignup)).rejects.toThrow(
        new UnauthorizedException('GOOGLE_TOKEN_EXPIRED'),
      );
    });

    it('should throw exception when google token is invalid', async () => {
      // Arrange
      adminService.verifyGoogleToken = jest
        .fn()
        .mockRejectedValue(new UnauthorizedException('INVALID_GOOGLE_TOKEN'));

      // Act & Assert
      await expect(adminService.googleSignup(mockGoogleSignup)).rejects.toThrow(
        new UnauthorizedException('INVALID_GOOGLE_TOKEN'),
      );
    });

    it('should throw exception when google token is malformed', async () => {
      // Arrange
      adminService.verifyGoogleToken = jest
        .fn()
        .mockRejectedValue(new UnauthorizedException('GOOGLE_TOKEN_MALFORMED'));

      // Act & Assert
      await expect(adminService.googleSignup(mockGoogleSignup)).rejects.toThrow(
        new UnauthorizedException('GOOGLE_TOKEN_MALFORMED'),
      );
    });

    it('should throw exception for general google auth errors', async () => {
      // Arrange
      adminService.verifyGoogleToken = jest
        .fn()
        .mockRejectedValue(new UnauthorizedException('GOOGLE_AUTH_ERROR'));

      // Act & Assert
      await expect(adminService.googleSignup(mockGoogleSignup)).rejects.toThrow(
        new UnauthorizedException('GOOGLE_AUTH_ERROR'),
      );
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
      prismaService.userOtp.delete = jest.fn().mockResolvedValue({});
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

      expect(prismaService.userOtp.delete).toHaveBeenCalledWith({
        where: { id: mockUser.otps[0].id },
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
      prismaService.userOtp.delete = jest.fn().mockResolvedValue({});
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
      prismaService.userOtp.update = jest.fn().mockResolvedValue({
        id: otpId,
        crmOtp: expect.any(Number),
        otpExpireTime: expect.any(Date),
        nextOtpTime: expect.any(Date),
      });
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

      expect(prismaService.userOtp.update).toHaveBeenCalledWith({
        where: { id: otpId },
        data: {
          crmOtp: expect.any(Number),
          otpExpireTime: expect.any(Date),
          nextOtpTime: expect.any(Date),
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
            userType: UserType.OWNER, // Important: Match the UserType.OWNER check in the method
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

  describe('register-organization', () => {
    it('should throw BadRequestException if user already owns an organization', async () => {
      // Arrange
      const userId = 'test-user-id';
      const mockUser = {
        id: 'existing-org-member-id',
        userId,
        organizationId: 'existing-org-id',
        userType: UserType.OWNER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const orgRegisterDto = { orgName: 'Test Org', orgCountry: 'Test Country' };

      prismaService.organizationMember.findFirst = jest.fn().mockResolvedValue(mockUser);

      // Act & Assert
      await expect(adminService.registerOrganization(userId, orgRegisterDto)).rejects.toThrow(
        new BadRequestException({ message: 'USER_ALREADY_REGISTERED' }),
      );

      expect(prismaService.organizationMember.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          userType: UserType.OWNER,
        },
      });
    });

    it('should throw BadRequestException if organization name already exists', async () => {
      // Arrange
      const userId = 'test-user-id';
      const orgRegisterDto = { orgName: 'Test Org', orgCountry: 'Test Country' };
      const existingOrg = {
        id: 'existing-org-id',
        name: 'Test Org',
        country: 'Existing Country',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaService.organizationMember.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.organization.findFirst = jest.fn().mockResolvedValue(existingOrg);

      // Act & Assert
      await expect(adminService.registerOrganization(userId, orgRegisterDto)).rejects.toThrow(
        new BadRequestException({ message: 'ORGANIZATION_ALREADY_EXISTS' }),
      );

      expect(prismaService.organization.findFirst).toHaveBeenCalledWith({
        where: {
          name: {
            equals: orgRegisterDto.orgName.trim(),
            mode: 'insensitive',
          },
        },
      });
    });

    it('should successfully register an organization with default department', async () => {
      // Arrange
      const userId = 'test-user-id';
      const orgRegisterDto = { orgName: 'Test Org', orgCountry: 'Test Country' };

      const generatedSubdomain = 'test-org'; // Expected generated subdomain

      const mockOrg = {
        id: 'new-org-id',
        name: orgRegisterDto.orgName,
        country: orgRegisterDto.orgCountry,
        subdomain: generatedSubdomain,
        createdById: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockOrgMembership = {
        id: 'new-org-member-id',
        userId,
        organizationId: mockOrg.id,
        userType: UserType.OWNER,
        adminRole: AdminRole.ADMIN,
        isDefaultOrganization: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockDepartment = {
        id: 'new-dept-id',
        name: 'General',
        description: 'Default department',
        organizationId: mockOrg.id,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockDeptMember = {
        id: 'new-dept-member-id',
        userId,
        departmentId: mockDepartment.id,
        workerRole: WorkerRole.ADMINISTRATOR,
        createdById: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaService.organizationMember.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.organization.findFirst = jest
        .fn()
        .mockResolvedValueOnce(null) // No existing org with same name
        .mockResolvedValueOnce(null); // No existing org with generated subdomain

      prismaService.$transaction = jest.fn().mockImplementation(async callback => {
        prismaService.organization.create = jest.fn().mockResolvedValue(mockOrg);
        prismaService.organizationMember.create = jest.fn().mockResolvedValue(mockOrgMembership);
        prismaService.department.create = jest.fn().mockResolvedValue(mockDepartment);
        prismaService.departmentMember.create = jest.fn().mockResolvedValue(mockDeptMember);

        return await callback(prismaService);
      });

      jest.spyOn(adminService, 'generateSubdomain').mockReturnValue(generatedSubdomain);

      // Act
      const result = await adminService.registerOrganization(userId, orgRegisterDto);

      // Assert
      expect(result).toStrictEqual({
        organizationId: mockOrg.id,
        subdomain: mockOrg.subdomain,
      });

      expect(prismaService.organizationMember.findFirst).toHaveBeenCalled();
      expect(prismaService.organization.findFirst).toHaveBeenCalledTimes(2);
      expect(prismaService.$transaction).toHaveBeenCalled();

      expect(prismaService.organization.create).toHaveBeenCalledWith({
        data: {
          name: orgRegisterDto.orgName,
          country: orgRegisterDto.orgCountry,
          createdById: userId,
          subdomain: generatedSubdomain,
        },
      });

      expect(prismaService.organizationMember.create).toHaveBeenCalledWith({
        data: {
          userId,
          organizationId: mockOrg.id,
          userType: UserType.OWNER,
          adminRole: AdminRole.ADMIN,
          isDefaultOrganization: true,
        },
      });

      expect(prismaService.department.create).toHaveBeenCalledWith({
        data: {
          name: 'General',
          description: 'Default department',
          organizationId: mockOrg.id,
          createdBy: userId,
        },
      });

      expect(prismaService.departmentMember.create).toHaveBeenCalledWith({
        data: {
          userId,
          departmentId: mockDepartment.id,
          workerRole: WorkerRole.ADMINISTRATOR,
          createdById: userId,
        },
      });
    });
  });

  describe('forgot-password', () => {
    let mockRequest = {
      ip: '127.0.0.1',
    };
    let forgotPasswordDto: ForgotPasswordDto;

    beforeEach(() => {
      mockRequest = { ip: '127.0.0.1' } as ECoreReq;
      forgotPasswordDto = { email: 'test@example.com' };
    });
    it('should throw BadRequestException if email does not exist', async () => {
      // Arrange
      const forgotPasswordDto = { email: 'nonexistent@example.com' };

      // Mock findUnique to return null
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);

      // Act & Assert
      await expect(
        adminService.forgotPassword(mockRequest as ECoreReq, forgotPasswordDto),
      ).rejects.toThrow(
        new BadRequestException({
          message: 'INVALID_EMAIL_OR_PASSWORD',
          data: { email: forgotPasswordDto.email },
        }),
      );

      // Verify IP and email blocking was called
      expect(ipBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(mockRequest.ip);
      expect(emailBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(forgotPasswordDto.email);
    });

    it('should throw BadRequestException if OTP cooldown is active', async () => {
      // Arrange
      const forgotPasswordDto = { email: 'test@example.com' };
      const currentTime = new Date();
      const futureTime = new Date(currentTime.getTime() + 60000); // 1 minute in the future

      const mockUser = {
        id: 'user-id',
        otps: [
          {
            id: 'otp-id',
            crmOtp: '123456',
            otpExpireTime: futureTime,
            nextOtpTime: futureTime,
          },
        ],
      };

      // Mock findUnique to return user with active cooldown
      prismaService.user.findUnique = jest.fn().mockResolvedValue(mockUser);

      // Act & Assert
      await expect(
        adminService.forgotPassword(mockRequest as ECoreReq, forgotPasswordDto),
      ).rejects.toThrow(
        new BadRequestException({
          message: 'OTP_COOLDOWN_TIME',
        }),
      );

      // Verify IP and email blocking was called
      expect(ipBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(mockRequest.ip);
      expect(emailBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(forgotPasswordDto.email);
    });

    it('should successfully generate and save OTP when user exists but no prior OTP', async () => {
      // Arrange
      const mockUser = { id: 'user-id', otps: [] };
      prismaService.user.findUnique = jest.fn().mockResolvedValue(mockUser);

      prismaService.$transaction = jest.fn().mockImplementation(async callback => {
        await callback({
          userOtp: { create: jest.fn() },
          user: { update: jest.fn() },
        });
      });

      // Act
      const response = await adminService.forgotPassword(
        mockRequest as ECoreReq,
        forgotPasswordDto,
      );

      // Assert
      expect(response).toHaveProperty('otp');
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should successfully update existing OTP when user has a previous OTP', async () => {
      // Arrange
      const mockUser = {
        id: 'user-id',
        otps: [{ id: 'otp-id', crmOtp: '654321' }],
      };
      prismaService.user.findUnique = jest.fn().mockResolvedValue(mockUser);

      prismaService.$transaction = jest.fn().mockImplementation(async callback => {
        await callback({
          userOtp: { update: jest.fn() },
          user: { update: jest.fn() },
        });
      });

      // Act
      const response = await adminService.forgotPassword(
        mockRequest as ECoreReq,
        forgotPasswordDto,
      );

      // Assert
      expect(response).toHaveProperty('otp');
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should set `isPasswordReset` flag to true after OTP generation', async () => {
      // Arrange
      const mockUser = { id: 'user-id', otps: [] };
      prismaService.user.findUnique = jest.fn().mockResolvedValue(mockUser);

      const updateUserMock = jest.fn();
      prismaService.$transaction = jest.fn().mockImplementation(async callback => {
        await callback({
          userOtp: { create: jest.fn() },
          user: { update: updateUserMock },
        });
      });

      // Act
      await adminService.forgotPassword(mockRequest as ECoreReq, forgotPasswordDto);

      // Assert
      expect(updateUserMock).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: { isPasswordReset: true },
      });
    });
  });

  describe('reset-password', () => {
    const mockRequest = {
      ip: '127.0.0.1',
    };
    const resetPasswordDto: ResetPasswordDto = {
      password: 'new-password123',
    };
    const userId = 'user-id123';
    it('should throw NotFoundException if user does not exist', async () => {
      // Arrange
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);

      // Act & Assert
      await expect(adminService.resetPassword(userId, resetPasswordDto)).rejects.toThrow(
        new NotFoundException({
          message: 'INVALID_EMAIL_OR_PASSWORD',
        }),
      );

      // Verify findUnique was called with correct parameters
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });

    it('should successfully reset password for existing user', async () => {
      // Arrange
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        isPasswordReset: true,
      };

      // Mock user findUnique
      prismaService.user.findUnique = jest.fn().mockResolvedValue(mockUser);

      // Mock password hashing
      const hashedPassword = 'hashed-password';
      jest.spyOn(hashingService, 'hashPassword').mockResolvedValue(hashedPassword);
      prismaService.user.update = jest
        .fn()
        .mockResolvedValue({ ...mockUser, password: hashedPassword, isPasswordReset: false });

      // Act
      const result = await adminService.resetPassword(userId, resetPasswordDto);

      // Assert
      expect(result).toBe(true);

      // Verify hashing was called
      expect(hashingService.hashPassword).toHaveBeenCalledWith(resetPasswordDto.password);

      // Verify update was called with correct parameters
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          password: hashedPassword,
          isPasswordReset: false,
        },
      });
    });
  });

  describe('get-plan-detail', () => {
    const mockPlans = [
      {
        id: '1',
        name: 'Basic Plan',
        description: 'Basic features for small teams',
        planType: 'STANDARD',
        isPopular: false,
        monthlyPrice: 9.99,
        yearlyPrice: 99.99,
        planFeatures: [
          {
            id: 'f1',
            featureName: 'Up to 5 users',
            featureType: 'NUMERIC',
          },
          {
            id: 'f2',
            featureName: 'Basic reporting',
            featureType: 'BOOLEAN',
          },
        ],
      },
      {
        id: '2',
        name: 'Premium Plan',
        description: 'Advanced features for growing teams',
        planType: 'PREMIUM',
        isPopular: true,
        monthlyPrice: 29.99,
        yearlyPrice: 299.99,
        planFeatures: [
          {
            id: 'f3',
            featureName: 'Unlimited users',
            featureType: 'NUMERIC',
          },
          {
            id: 'f4',
            featureName: 'Advanced reporting',
            featureType: 'BOOLEAN',
          },
          {
            id: 'f5',
            featureName: 'Priority support',
            featureType: 'BOOLEAN',
          },
        ],
      },
    ];

    it('should return plans categorized as standard and premium', async () => {
      // Arrange
      prismaService.plan.findMany = jest.fn().mockResolvedValue(mockPlans);

      // Act
      const result: GetPlanDetailsResponse = await adminService.getPlanDetail();

      // Assert
      expect(result).toHaveProperty('standardPlans');
      expect(result).toHaveProperty('premiumPlans');
      expect(prismaService.plan.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          planType: true,
          isPopular: true,
          monthlyPrice: true,
          yearlyPrice: true,
          planFeatures: {
            where: { isEnabled: true },
            select: {
              id: true,
              featureName: true,
              featureType: true,
            },
          },
        },
      });
    });

    it('should return empty arrays when no plans are found', async () => {
      // Arrange
      prismaService.plan.findMany = jest.fn().mockResolvedValue([]);

      // Act
      const result = await adminService.getPlanDetail();

      // Assert
      expect(result.standardPlans).toEqual([]);
      expect(result.premiumPlans).toEqual([]);
    });
  });

  describe('/crm/login', () => {
    const mockRequest = {
      ip: '127.0.0.1',
    };

    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };
    it('should throw UnauthorizedException when user does not exist', async () => {
      // Arrange
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        adminService.crmLogin(mockRequest as ECoreReq, loginDto, Platform.WEBSITE),
      ).rejects.toThrow(new UnauthorizedException('INVALID_CREDENTIAL'));

      // Verify method calls
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: {
          email: loginDto.email,
          deleted: false,
        },
      });
      expect(ipBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(mockRequest.ip);
      expect(emailBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(loginDto.email);
    });

    it('should throw UnauthorizedException when password is incorrect', async () => {
      // Arrange
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        password: 'hashed-password',
        emailVerified: true,
      };

      prismaService.user.findUnique = jest.fn().mockResolvedValue(mockUser);
      hashingService.comparePasswords = jest.fn().mockResolvedValue(false);
      ipBlockingGuard.trackFailedAttempt = jest.fn().mockResolvedValue(undefined);
      emailBlockingGuard.trackFailedAttempt = jest.fn().mockResolvedValue(undefined);

      // Act & Assert
      await expect(
        adminService.crmLogin(mockRequest as ECoreReq, loginDto, Platform.WEBSITE),
      ).rejects.toThrow(new UnauthorizedException('INVALID_CREDENTIAL'));

      // Verify method calls
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: {
          email: loginDto.email,
          deleted: false,
        },
      });
      expect(hashingService.comparePasswords).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );
      expect(ipBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(mockRequest.ip);
      expect(emailBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(loginDto.email);
    });

    it('should throw HttpException when user profile is incomplete', async () => {
      // Arrange
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        password: 'hashed-password',
        emailVerified: true,
        firstName: null,
        lastName: null,
        phoneNumber: null,
        organizationMembers: [],
      };

      // Use mockResolvedValueOnce for EACH call to findUnique
      // First call is in validateUser
      prismaService.user.findUnique = jest
        .fn()
        .mockResolvedValueOnce(mockUser) // First call (validateUser)
        .mockResolvedValueOnce(mockUser); // Second call (validateUserStatus)

      hashingService.comparePasswords = jest.fn().mockResolvedValue(true);

      // Act & Assert
      await expect(
        adminService.crmLogin(mockRequest as ECoreReq, loginDto, Platform.WEBSITE),
      ).rejects.toThrow(
        new HttpException(
          {
            message: 'INCOMPLETE_PROFILE',
          },
          HttpStatus.ACCEPTED,
        ),
      );

      // Verify user findUnique was called twice
      expect(prismaService.user.findUnique).toHaveBeenCalledTimes(2);
      expect(prismaService.user.findUnique).toHaveBeenNthCalledWith(1, {
        where: {
          email: loginDto.email,
          deleted: false,
        },
      });
      expect(prismaService.user.findUnique).toHaveBeenNthCalledWith(2, {
        where: { id: mockUser.id },
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
    });

    it('should throw HttpException when user is not associated with any organization', async () => {
      // Arrange
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        password: 'hashed-password',
        emailVerified: true,
        firstName: 'Test',
        lastName: 'User',
        phoneNumber: '1234567890',
        organizationMembers: [], // Empty array - no organizations
      };

      // CHAIN the mocks instead of overriding
      prismaService.user.findUnique = jest
        .fn()
        .mockResolvedValueOnce(mockUser) // First call in validateUser
        .mockResolvedValueOnce(mockUser); // Second call in validateUserStatus

      hashingService.comparePasswords = jest.fn().mockResolvedValue(true);

      // Act & Assert
      await expect(
        adminService.crmLogin(mockRequest as ECoreReq, loginDto, Platform.WEBSITE),
      ).rejects.toThrow(
        new HttpException(
          {
            message: 'USER_NOT_ASSOCIATED_WITH_ANY_ORGANIZATION',
          },
          203,
        ),
      );

      // Verify method calls
      expect(prismaService.user.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should throw HttpException when user has no active subscription', async () => {
      // Arrange
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        password: 'hashed-password',
        firstName: 'Test',
        emailVerified: true,
        lastName: 'User',
        phoneNumber: '1234567890',
        organizationMembers: [
          {
            userType: UserType.OWNER,
            organization: {
              subscription: null, // No subscription
            },
          },
        ],
      };

      // CHAIN the mocks instead of overriding
      prismaService.user.findUnique = jest
        .fn()
        .mockResolvedValueOnce(mockUser) // First call in validateUser
        .mockResolvedValueOnce(mockUser); // Second call in validateUserStatus

      hashingService.comparePasswords = jest.fn().mockResolvedValue(true);

      // Act & Assert
      await expect(
        adminService.crmLogin(mockRequest as ECoreReq, loginDto, Platform.WEBSITE),
      ).rejects.toThrow(
        new HttpException(
          {
            message: 'USER_NOT_TAKEN_ANY_PLAN',
            statusCode: 206,
          },
          206,
        ),
      );

      // Verify method calls
      expect(prismaService.user.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should throw UnauthorizedException when subscription is expired', async () => {
      // Arrange
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        password: 'hashed-password',
        firstName: 'Test',
        lastName: 'User',
        emailVerified: true,
        phoneNumber: '1234567890',
        organizationMembers: [
          {
            userType: UserType.OWNER,
            organization: {
              id: 'org-id',
              name: 'Test Organization',
              subscription: {
                status: 'ACTIVE',
                endDate: new Date(Date.now() + 86400000), // Initial valid date
                plan: {
                  id: 'plan-id',
                  name: 'Standard Plan',
                },
              },
            },
          },
        ],
      };

      const mockOrgMember = {
        userId: 'user-id',
        organizationId: 'org-id',
        userType: 'WORKER',
        organization: {
          id: 'org-id',
          name: 'Test Organization',
          subscription: {
            status: 'ACTIVE',
            endDate: new Date(Date.now() + 86400000),
            plan: {
              id: 'plan-id',
              name: 'Standard Plan',
            },
          },
        },
      };

      // Set up all mocks before calling the function
      // This is better than setting them one by one
      prismaService.user.findUnique = jest
        .fn()
        .mockResolvedValueOnce(mockUser) // First call in validateUser
        .mockResolvedValueOnce(mockUser); // Second call in validateUserStatus

      hashingService.comparePasswords = jest.fn().mockResolvedValue(true);
      prismaService.organizationMember.findFirst = jest.fn().mockResolvedValue(mockOrgMember);

      // Mock the expired subscription
      prismaService.organizationSubscription.findUnique = jest.fn().mockResolvedValue({
        status: 'ACTIVE',
        endDate: new Date(Date.now() - 86400000), // Past date - expired
      });

      // Act & Assert
      await expect(
        adminService.crmLogin(mockRequest as ECoreReq, loginDto, Platform.WEBSITE),
      ).rejects.toThrow(new UnauthorizedException('SUBSCRIPTION_EXPIRED'));

      // Verify all required method calls
      expect(prismaService.user.findUnique).toHaveBeenCalledTimes(2);
      expect(hashingService.comparePasswords).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );
      expect(prismaService.organizationMember.findFirst).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          isDefaultOrganization: true,
        },
        include: {
          organization: {
            include: {
              subscription: {
                include: {
                  plan: true,
                },
              },
            },
          },
        },
      });
      expect(prismaService.organizationSubscription.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-id',
        },
        select: {
          status: true,
          endDate: true,
        },
      });
    });

    it('should skip subscription validation for OWNER user type', async () => {
      // Arrange - setup an owner user
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        password: 'hashed-password',
        firstName: 'Test',
        lastName: 'User',
        emailVerified: true,
        phoneNumber: '1234567890',
        organizationMembers: [
          {
            userType: UserType.OWNER,
            organization: {
              id: 'org-id',
              name: 'Test Organization',
              subdomain: 'test-org',
              subscription: {
                status: 'ACTIVE',
                endDate: new Date(Date.now() + 86400000), // Initial valid date
                plan: {
                  id: 'plan-id',
                  name: 'Standard Plan',
                },
              },
            },
          },
        ],
      };

      const mockOrgMember = {
        userId: 'owner-id',
        organizationId: 'org-id',
        userType: 'OWNER', // OWNER type - this is key for the test
        organization: {
          id: 'org-id',
          name: 'Test Organization',
          subdomain: 'test-org',
          subscription: {
            status: 'ACTIVE',
            endDate: new Date(Date.now() + 86400000),
            plan: {
              id: 'plan-id',
              name: 'Standard Plan',
            },
          },
        },
      };

      // Set up all mocks
      prismaService.user.findUnique = jest
        .fn()
        .mockResolvedValueOnce(mockUser) // First call in validateUser
        .mockResolvedValueOnce(mockUser); // Second call in validateUserStatus

      hashingService.comparePasswords = jest.fn().mockResolvedValue(true);
      prismaService.organizationMember.findFirst = jest.fn().mockResolvedValue(mockOrgMember);
      prismaService.user.update = jest.fn().mockResolvedValue({
        ...mockUser,
        lastLoginAt: new Date(),
      });

      prismaService.organizationMember.update = jest.fn().mockResolvedValue({
        ...mockOrgMember,
      });

      const mockSubdomainToken = 'mock-subdomain-token';
      jwtService.generateSubdomainToken = jest.fn().mockResolvedValue(mockSubdomainToken);

      // Act
      const result = await adminService.crmLogin(
        mockRequest as ECoreReq,
        loginDto,
        Platform.WEBSITE,
      );

      // Assert
      // For OWNER user type, validateMemberSubscription should NOT be called
      expect(prismaService.organizationSubscription.findUnique).not.toHaveBeenCalled();
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });
      expect(jwtService.generateSubdomainToken).toHaveBeenCalledWith(
        mockUser.id,
        mockOrgMember.organization.id,
        expect.any(String),
      );
      expect(prismaService.organizationMember.update).toHaveBeenCalledWith({
        where: {
          userId_organizationId: {
            userId: mockUser.id,
            organizationId: mockOrgMember.organization.id,
          },
        },
        data: {
          accessTokenCRMId: null,
          refreshTokenCRMId: expect.any(String),
        },
      });
      expect(result).toEqual({
        subdomainToken: mockSubdomainToken,
        organizationSubdomain: mockOrgMember.organization.subdomain,
      });
    });

    it('should successfully log in with active subscription for WORKER', async () => {
      // Arrange
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        password: 'hashed-password',
        firstName: 'Test',
        lastName: 'User',
        emailVerified: true,
        phoneNumber: '1234567890',
        organizationMembers: [
          {
            userType: UserType.WORKER,
            organization: {
              id: 'org-id',
              name: 'Test Organization',
              subdomain: 'test-org',
              subscription: {
                status: 'ACTIVE',
                endDate: new Date(Date.now() + 86400000), // Initial valid date
                plan: {
                  id: 'plan-id',
                  name: 'Standard Plan',
                },
              },
            },
          },
        ],
      };

      const mockOrgMember = {
        userId: 'user-id',
        organizationId: 'org-id',
        userType: 'WORKER',
        organization: {
          id: 'org-id',
          name: 'Test Organization',
          subdomain: 'test-org',
          subscription: {
            status: 'ACTIVE',
            endDate: new Date(Date.now() + 86400000),
            plan: {
              id: 'plan-id',
              name: 'Standard Plan',
            },
          },
        },
      };

      const mockSubscription = {
        status: 'ACTIVE',
        endDate: new Date(Date.now() + 86400000), // Future date - valid subscription
      };

      // Set up all mocks
      prismaService.user.findUnique = jest
        .fn()
        .mockResolvedValueOnce(mockUser) // First call in validateUser
        .mockResolvedValueOnce(mockUser); // Second call in validateUserStatus

      hashingService.comparePasswords = jest.fn().mockResolvedValue(true);
      prismaService.organizationMember.findFirst = jest.fn().mockResolvedValue(mockOrgMember);
      prismaService.organizationSubscription.findUnique = jest
        .fn()
        .mockResolvedValue(mockSubscription);
      prismaService.user.update = jest.fn().mockResolvedValue({
        ...mockUser,
        lastLoginAt: new Date(),
      });

      const mockSubdomainToken = 'mock-subdomain-token';
      jwtService.generateSubdomainToken = jest.fn().mockResolvedValue(mockSubdomainToken);
      prismaService.organizationMember.update = jest.fn().mockResolvedValue(mockOrgMember);

      // Act
      const result = await adminService.crmLogin(
        mockRequest as ECoreReq,
        loginDto,
        Platform.WEBSITE,
      );

      // Assert - verify all steps were executed
      expect(prismaService.user.findUnique).toHaveBeenCalledTimes(2);
      expect(hashingService.comparePasswords).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );
      expect(prismaService.organizationMember.findFirst).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          isDefaultOrganization: true,
        },
        include: {
          organization: {
            include: {
              subscription: {
                include: {
                  plan: true,
                },
              },
            },
          },
        },
      });
      expect(prismaService.organizationSubscription.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId: mockOrgMember.organization.id,
        },
        select: {
          status: true,
          endDate: true,
        },
      });
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });
      expect(jwtService.generateSubdomainToken).toHaveBeenCalledWith(
        mockUser.id,
        mockOrgMember.organization.id,
        expect.any(String),
      );
      expect(prismaService.organizationMember.update).toHaveBeenCalledWith({
        where: {
          userId_organizationId: {
            userId: mockUser.id,
            organizationId: mockOrgMember.organization.id,
          },
        },
        data: {
          accessTokenCRMId: null,
          refreshTokenCRMId: expect.any(String),
        },
      });
      expect(result).toEqual({
        subdomainToken: mockSubdomainToken,
        organizationSubdomain: mockOrgMember.organization.subdomain,
      });
    });
  });

  describe('/app-extension/login', () => {
    const mockRequest = {
      ip: '127.0.0.1',
    };

    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockUser = {
      id: 'user-id',
      email: 'test@example.com',
      password: 'hashed-password',
      firstName: 'Test',
      lastName: 'User',
      emailVerified: true,
      phoneNumber: '1234567890',
      organizationMembers: [
        {
          userType: UserType.OWNER,
          organization: {
            id: 'org-id',
            name: 'Test Organization',
            subscription: {
              status: 'ACTIVE',
              endDate: new Date(Date.now() + 86400000), // Initial valid date
              plan: {
                id: 'plan-id',
                name: 'Standard Plan',
              },
            },
          },
        },
      ],
    };

    // Global mock for organization member
    const mockOrgMember = {
      userId: 'user-id',
      organizationId: 'org-id',
      userType: 'WORKER',
      organization: {
        id: 'org-id',
        name: 'Test Organization',
        subscription: {
          status: 'ACTIVE',
          endDate: new Date(Date.now() + 86400000),
          plan: {
            id: 'plan-id',
            name: 'Standard Plan',
          },
        },
      },
    };

    // Global mock for valid subscription
    const mockValidSubscription = {
      status: 'ACTIVE',
      endDate: new Date(Date.now() + 86400000), // Future date - valid subscription
    };

    // Global mock for tokens
    const mockTokens = {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    };

    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks();

      // Setup default successful mocks
      prismaService.user.findUnique = jest.fn().mockResolvedValue(mockUser);
      hashingService.comparePasswords = jest.fn().mockResolvedValue(true);
      prismaService.organizationMember.findFirst = jest.fn().mockResolvedValue(mockOrgMember);
      prismaService.organizationSubscription.findUnique = jest
        .fn()
        .mockResolvedValue(mockValidSubscription);
      prismaService.user.update = jest.fn().mockResolvedValue({
        ...mockUser,
        lastLoginAt: new Date(),
      });
      jwtService.generateTokens = jest.fn().mockResolvedValue(mockTokens);
      prismaService.organizationMember.update = jest.fn().mockResolvedValue(mockOrgMember);
      ipBlockingGuard.trackFailedAttempt = jest.fn().mockResolvedValue(undefined);
      emailBlockingGuard.trackFailedAttempt = jest.fn().mockResolvedValue(undefined);
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      // Arrange - override the default mock for this test
      prismaService.user.findUnique = jest.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(
        adminService.appExtensionLogin(mockRequest as ECoreReq, loginDto, Platform.APP),
      ).rejects.toThrow(new UnauthorizedException('INVALID_CREDENTIAL'));

      // Verify method calls
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: {
          email: loginDto.email,
          deleted: false,
        },
      });
      expect(ipBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(mockRequest.ip);
      expect(emailBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(loginDto.email);
    });

    it('should throw UnauthorizedException when password is incorrect', async () => {
      // Arrange - override the default mock for this test
      hashingService.comparePasswords = jest.fn().mockResolvedValue(false);

      // Act & Assert
      await expect(
        adminService.appExtensionLogin(mockRequest as ECoreReq, loginDto, Platform.APP),
      ).rejects.toThrow(new UnauthorizedException('INVALID_CREDENTIAL'));

      // Verify method calls
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: {
          email: loginDto.email,
          deleted: false,
        },
      });
      expect(hashingService.comparePasswords).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );
      expect(ipBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(mockRequest.ip);
      expect(emailBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(loginDto.email);
    });

    it('should throw HttpException when user profile is incomplete', async () => {
      // Arrange - create an incomplete profile user
      const incompleteUser = {
        ...mockUser,
        firstName: null,
        lastName: null,
        phoneNumber: null,
      };

      // Override the user.findUnique mocks for this test
      prismaService.user.findUnique = jest
        .fn()
        .mockResolvedValueOnce(incompleteUser) // First call (validateUser)
        .mockResolvedValueOnce(incompleteUser); // Second call (validateUserStatus)

      // Act & Assert
      await expect(
        adminService.appExtensionLogin(mockRequest as ECoreReq, loginDto, Platform.APP),
      ).rejects.toThrow(
        new HttpException(
          {
            message: 'INCOMPLETE_PROFILE',
          },
          HttpStatus.ACCEPTED,
        ),
      );

      // Verify user findUnique was called twice
      expect(prismaService.user.findUnique).toHaveBeenCalledTimes(2);
      expect(prismaService.user.findUnique).toHaveBeenNthCalledWith(1, {
        where: {
          email: loginDto.email,
          deleted: false,
        },
      });
      expect(prismaService.user.findUnique).toHaveBeenNthCalledWith(2, {
        where: { id: mockUser.id },
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
    });

    it('should throw HttpException when user is not associated with any organization', async () => {
      // Arrange - create a user with no organizations
      const userWithNoOrgs = {
        ...mockUser,
        organizationMembers: [], // Empty array - no organizations
      };

      // Override the user.findUnique mocks for this test
      prismaService.user.findUnique = jest
        .fn()
        .mockResolvedValueOnce(userWithNoOrgs) // First call in validateUser
        .mockResolvedValueOnce(userWithNoOrgs); // Second call in validateUserStatus

      // Act & Assert
      await expect(
        adminService.appExtensionLogin(mockRequest as ECoreReq, loginDto, Platform.APP),
      ).rejects.toThrow(
        new HttpException(
          {
            message: 'USER_NOT_ASSOCIATED_WITH_ANY_ORGANIZATION',
          },
          203,
        ),
      );

      // Verify method calls
      expect(prismaService.user.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should throw HttpException when user has no active subscription', async () => {
      // Arrange - create a user with no subscription
      const userWithNoSubscription = {
        ...mockUser,
        organizationMembers: [
          {
            userType: UserType.OWNER,
            organization: {
              subscription: null, // No subscription
            },
          },
        ],
      };

      // Override the user.findUnique mocks for this test
      prismaService.user.findUnique = jest
        .fn()
        .mockResolvedValueOnce(userWithNoSubscription) // First call in validateUser
        .mockResolvedValueOnce(userWithNoSubscription); // Second call in validateUserStatus

      // Act & Assert
      await expect(
        adminService.appExtensionLogin(mockRequest as ECoreReq, loginDto, Platform.APP),
      ).rejects.toThrow(
        new HttpException(
          {
            message: 'USER_NOT_TAKEN_ANY_PLAN',
            statusCode: 206,
          },
          206,
        ),
      );

      // Verify method calls
      expect(prismaService.user.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should throw UnauthorizedException when subscription is expired', async () => {
      // Mock the expired subscription
      prismaService.organizationSubscription.findUnique = jest.fn().mockResolvedValue({
        status: 'ACTIVE',
        endDate: new Date(Date.now() - 86400000), // Past date - expired
      });

      // Act & Assert
      await expect(
        adminService.appExtensionLogin(mockRequest as ECoreReq, loginDto, Platform.APP),
      ).rejects.toThrow(new UnauthorizedException('SUBSCRIPTION_EXPIRED'));

      // Verify all required method calls
      expect(prismaService.user.findUnique).toHaveBeenCalledTimes(2);
      expect(hashingService.comparePasswords).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );
      expect(prismaService.organizationMember.findFirst).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          isDefaultOrganization: true,
        },
        include: {
          organization: {
            include: {
              subscription: {
                include: {
                  plan: true,
                },
              },
            },
          },
        },
      });
      expect(prismaService.organizationSubscription.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-id',
        },
        select: {
          status: true,
          endDate: true,
        },
      });
    });

    it('should successfully log in with APP platform and set correct token fields', async () => {
      // Using mockOrgMember and mockUser from the setup with updated fields
      const mockOrgMember = {
        userId: 'user-id',
        organizationId: 'org-id',
        userType: 'WORKER',
        organization: {
          id: 'org-id',
          name: 'Test Organization',
          subdomain: undefined, // Match the expected undefined value
          subscription: {
            status: 'ACTIVE',
            endDate: new Date(Date.now() + 86400000),
            plan: {
              id: 'plan-id',
              name: 'Standard Plan',
            },
          },
        },
      };

      prismaService.organizationMember.findFirst = jest.fn().mockResolvedValue(mockOrgMember);

      // Act
      const result = await adminService.appExtensionLogin(
        mockRequest as ECoreReq,
        loginDto,
        Platform.APP,
      );

      // Assert
      expect(result).toEqual({
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
        organizationId: mockOrgMember.organization.id,
        userId: mockUser.id,
        phoneNumber: mockUser.phoneNumber,
        organizationName: mockOrgMember.organization.name,
        organizationSubdomain: mockOrgMember.organization.subdomain,
      });
    });

    it('should successfully log in with EXTENSION platform and set correct token fields', async () => {
      // Using mockOrgMember with updated fields
      const mockOrgMember = {
        userId: 'user-id',
        organizationId: 'org-id',
        userType: 'WORKER',
        organization: {
          id: 'org-id',
          name: 'Test Organization',
          subdomain: undefined, // Match the expected undefined value
          subscription: {
            status: 'ACTIVE',
            endDate: new Date(Date.now() + 86400000),
            plan: {
              id: 'plan-id',
              name: 'Standard Plan',
            },
          },
        },
      };

      prismaService.organizationMember.findFirst = jest.fn().mockResolvedValue(mockOrgMember);

      // Act
      const result = await adminService.appExtensionLogin(
        mockRequest as ECoreReq,
        loginDto,
        Platform.EXTENSION,
      );

      // Assert
      expect(result).toEqual({
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
        organizationId: mockOrgMember.organization.id,
        userId: mockUser.id,
        phoneNumber: mockUser.phoneNumber,
        organizationName: mockOrgMember.organization.name,
        organizationSubdomain: mockOrgMember.organization.subdomain,
      });
    });
  });

  describe('/google-login/app', () => {
    // Common mock objects
    const mockRequest = {
      ip: '127.0.0.1',
    };

    const googleSigninDto: GoogleSigninDto = {
      token: 'google-token-123',
    };

    // Mock Google token payload
    const mockGooglePayload = {
      sub: 'google-sub-123',
      email: 'test@example.com',
      email_verified: true,
      name: 'Test User',
      given_name: 'Test',
      family_name: 'User',
    };

    // Global mock user with complete profile
    const mockUser = {
      id: 'user-id',
      email: 'test@example.com',
      password: 'hashed-password',
      firstName: 'Test',
      lastName: 'User',
      emailVerified: true,
      phoneNumber: '1234567890',
      organizationMembers: [
        {
          userType: UserType.OWNER,
          organization: {
            id: 'org-id',
            name: 'Test Organization',
            subscription: {
              status: 'ACTIVE',
              endDate: new Date(Date.now() + 86400000), // Initial valid date
              plan: {
                id: 'plan-id',
                name: 'Standard Plan',
              },
            },
          },
        },
      ],
    };

    // Global mock for organization member
    const mockOrgMember = {
      userId: 'user-id',
      organizationId: 'org-id',
      userType: 'WORKER',
      organization: {
        id: 'org-id',
        name: 'Test Organization',
        subscription: {
          status: 'ACTIVE',
          endDate: new Date(Date.now() + 86400000),
          plan: {
            id: 'plan-id',
            name: 'Standard Plan',
          },
        },
      },
    };

    // Global mock for valid subscription
    const mockValidSubscription = {
      status: 'ACTIVE',
      endDate: new Date(Date.now() + 86400000), // Future date - valid subscription
    };

    // Global mock for tokens
    const mockTokens = {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    };

    // Setup common mocks before each test
    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks();

      // Setup default successful mocks
      adminService.verifyGoogleToken = jest.fn().mockResolvedValue(mockGooglePayload);
      prismaService.user.findUnique = jest.fn().mockResolvedValue(mockUser);
      prismaService.organizationMember.findFirst = jest.fn().mockResolvedValue(mockOrgMember);
      prismaService.organizationSubscription.findUnique = jest
        .fn()
        .mockResolvedValue(mockValidSubscription);
      prismaService.user.update = jest.fn().mockResolvedValue({
        ...mockUser,
        googleId: mockGooglePayload.sub,
        emailVerified: true,
        lastLoginAt: new Date(),
      });
      jwtService.generateTokens = jest.fn().mockResolvedValue(mockTokens);
      prismaService.organizationMember.update = jest.fn().mockResolvedValue(mockOrgMember);
      ipBlockingGuard.trackFailedAttempt = jest.fn().mockResolvedValue(undefined);
      emailBlockingGuard.trackFailedAttempt = jest.fn().mockResolvedValue(undefined);
    });

    it('should throw UnauthorizedException when google token verification fails', async () => {
      // Arrange
      const error = new Error('Invalid token');
      adminService.verifyGoogleToken = jest.fn().mockRejectedValue(error);

      // Act & Assert
      await expect(
        adminService.googleLoginApp(mockRequest as ECoreReq, googleSigninDto),
      ).rejects.toThrow(error);

      // Verify method calls
      expect(adminService.verifyGoogleToken).toHaveBeenCalledWith(googleSigninDto.token);
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      // Arrange
      prismaService.user.findUnique = jest.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(
        adminService.googleLoginApp(mockRequest as ECoreReq, googleSigninDto),
      ).rejects.toThrow(new UnauthorizedException('USER_NOT_FOUND'));

      // Verify method calls
      expect(adminService.verifyGoogleToken).toHaveBeenCalledWith(googleSigninDto.token);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: {
          email: mockGooglePayload.email,
          deleted: false,
        },
      });
      expect(ipBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(mockRequest.ip);
      expect(emailBlockingGuard.trackFailedAttempt).toHaveBeenCalledWith(mockGooglePayload.email);
    });

    it('should throw HttpException when user profile is incomplete', async () => {
      // Arrange - create an incomplete profile user
      const incompleteUser = {
        ...mockUser,
        firstName: null,
        lastName: null,
        phoneNumber: null,
      };

      // Override the user.findUnique mocks for this test
      prismaService.user.findUnique = jest
        .fn()
        .mockResolvedValueOnce(incompleteUser) // First call (finding user)
        .mockResolvedValueOnce(incompleteUser); // Second call (validateUserStatus)

      // Act & Assert
      await expect(
        adminService.googleLoginApp(mockRequest as ECoreReq, googleSigninDto),
      ).rejects.toThrow(
        new HttpException(
          {
            message: 'INCOMPLETE_PROFILE',
          },
          HttpStatus.ACCEPTED,
        ),
      );

      // Verify user findUnique was called twice
      expect(prismaService.user.findUnique).toHaveBeenCalledTimes(2);
      expect(prismaService.user.findUnique).toHaveBeenNthCalledWith(1, {
        where: {
          email: mockGooglePayload.email,
          deleted: false,
        },
      });
      expect(prismaService.user.findUnique).toHaveBeenNthCalledWith(2, {
        where: { id: mockUser.id },
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
    });

    it('should throw HttpException when user is not associated with any organization', async () => {
      // Arrange - create a user with no organizations
      const userWithNoOrgs = {
        ...mockUser,
        organizationMembers: [], // Empty array - no organizations
      };

      // Override the user.findUnique mocks for this test
      prismaService.user.findUnique = jest
        .fn()
        .mockResolvedValueOnce(userWithNoOrgs) // First call in finding user
        .mockResolvedValueOnce(userWithNoOrgs); // Second call in validateUserStatus

      // Act & Assert
      await expect(
        adminService.googleLoginApp(mockRequest as ECoreReq, googleSigninDto),
      ).rejects.toThrow(
        new HttpException(
          {
            message: 'USER_NOT_ASSOCIATED_WITH_ANY_ORGANIZATION',
          },
          203,
        ),
      );

      // Verify method calls
      expect(prismaService.user.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should throw HttpException when user has no active subscription', async () => {
      // Arrange - create a user with no subscription
      const userWithNoSubscription = {
        ...mockUser,
        organizationMembers: [
          {
            userType: UserType.OWNER,
            organization: {
              subscription: null, // No subscription
            },
          },
        ],
      };

      // Override the user.findUnique mocks for this test
      prismaService.user.findUnique = jest
        .fn()
        .mockResolvedValueOnce(userWithNoSubscription) // First call in finding user
        .mockResolvedValueOnce(userWithNoSubscription); // Second call in validateUserStatus

      // Act & Assert
      await expect(
        adminService.googleLoginApp(mockRequest as ECoreReq, googleSigninDto),
      ).rejects.toThrow(
        new HttpException(
          {
            message: 'USER_NOT_TAKEN_ANY_PLAN',
            statusCode: 206,
          },
          206,
        ),
      );

      // Verify method calls
      expect(prismaService.user.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should throw UnauthorizedException when subscription is expired', async () => {
      // Mock the expired subscription
      prismaService.organizationSubscription.findUnique = jest.fn().mockResolvedValue({
        status: 'ACTIVE',
        endDate: new Date(Date.now() - 86400000), // Past date - expired
      });

      // Act & Assert
      await expect(
        adminService.googleLoginApp(mockRequest as ECoreReq, googleSigninDto),
      ).rejects.toThrow(new UnauthorizedException('SUBSCRIPTION_EXPIRED'));

      // Verify all required method calls
      expect(prismaService.user.findUnique).toHaveBeenCalledTimes(2);
      expect(prismaService.organizationMember.findFirst).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          isDefaultOrganization: true,
        },
        include: {
          organization: {
            include: {
              subscription: {
                include: {
                  plan: true,
                },
              },
            },
          },
        },
      });
      expect(prismaService.organizationSubscription.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-id',
        },
        select: {
          status: true,
          endDate: true,
        },
      });
    });

    it('should successfully log in with Google and update user profile', async () => {
      // Using mockOrgMember with updated fields
      const mockOrgMember = {
        userId: 'user-id',
        organizationId: 'org-id',
        userType: 'WORKER',
        organization: {
          id: 'org-id',
          name: 'Test Organization',
          subdomain: undefined, // Match the expected undefined value
          subscription: {
            status: 'ACTIVE',
            endDate: new Date(Date.now() + 86400000),
            plan: {
              id: 'plan-id',
              name: 'Standard Plan',
            },
          },
        },
      };

      prismaService.organizationMember.findFirst = jest.fn().mockResolvedValue(mockOrgMember);

      // Act
      const result = await adminService.googleLoginApp(mockRequest as ECoreReq, googleSigninDto);

      // Assert
      expect(result).toEqual({
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
        organizationId: mockOrgMember.organization.id,
        userId: mockUser.id,
        organizationName: mockOrgMember.organization.name,
        organizationSubdomain: mockOrgMember.organization.subdomain,
      });
    });
  });

  describe('/google-login/crm', () => {
    // Common mock objects
    const mockRequest = {
      ip: '127.0.0.1',
    };

    const googleSigninDto: GoogleSigninDto = {
      token: 'google-token-123',
    };

    // Mock Google token payload
    const mockGooglePayload = {
      sub: 'google-sub-123',
      email: 'test@example.com',
      email_verified: true,
      name: 'Test User',
      given_name: 'Test',
      family_name: 'User',
    };

    // Global mock user with complete profile
    const mockUser = {
      id: 'user-id',
      email: 'test@example.com',
      password: 'hashed-password',
      firstName: 'Test',
      lastName: 'User',
      emailVerified: true,
      phoneNumber: '1234567890',
      organizationMembers: [
        {
          userType: UserType.OWNER,
          organization: {
            id: 'org-id',
            name: 'Test Organization',
            subscription: {
              status: 'ACTIVE',
              endDate: new Date(Date.now() + 86400000), // Initial valid date
              plan: {
                id: 'plan-id',
                name: 'Standard Plan',
              },
            },
          },
        },
      ],
    };

    // Global mock for new user
    const mockNewUser = {
      id: 'new-user-id',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      googleId: 'google-sub-123',
      emailVerified: true,
      authProvider: 'GOOGLE',
    };

    // Global mock for organization member
    const mockOrgMember = {
      userId: 'user-id',
      organizationId: 'org-id',
      userType: 'WORKER', // Default to WORKER, tests can override
      organization: {
        id: 'org-id',
        name: 'Test Organization',
        subscription: {
          status: 'ACTIVE',
          endDate: new Date(Date.now() + 86400000),
          plan: {
            id: 'plan-id',
            name: 'Standard Plan',
          },
        },
      },
    };

    // Global mock for valid subscription
    const mockValidSubscription = {
      status: 'ACTIVE',
      endDate: new Date(Date.now() + 86400000), // Future date - valid subscription
    };

    // Global mock for tokens
    const mockTokens = {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    };

    // Global mock for JWT token
    const mockJwtToken = 'mock-jwt-token';

    // Setup common mocks before each test
    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks();

      // Setup default successful mocks
      adminService.verifyGoogleToken = jest.fn().mockResolvedValue(mockGooglePayload);
      prismaService.user.findUnique = jest.fn().mockResolvedValue(mockUser);
      prismaService.user.create = jest.fn().mockResolvedValue(mockNewUser);
      prismaService.organizationMember.findFirst = jest.fn().mockResolvedValue(mockOrgMember);
      prismaService.organizationSubscription.findUnique = jest
        .fn()
        .mockResolvedValue(mockValidSubscription);
      prismaService.user.update = jest.fn().mockResolvedValue({
        ...mockUser,
        googleId: mockGooglePayload.sub,
        emailVerified: true,
        lastLoginAt: new Date(),
      });

      // Properly mock organizationMember.update with jest.fn()
      prismaService.organizationMember.update = jest.fn().mockResolvedValue({
        userId: mockUser.id,
        organizationId: mockOrgMember.organization.id,
        accessTokenCRMId: null,
        refreshTokenCRMId: 'mock-subdomain-token-id',
      });

      jwtService.generateToken = jest.fn().mockResolvedValue(mockJwtToken);
      adminService.generateCrmTokens = jest.fn().mockResolvedValue(mockTokens);
    });

    it('should throw error when google token verification fails', async () => {
      // Arrange
      const error = new Error('Invalid token');
      adminService.verifyGoogleToken = jest.fn().mockRejectedValue(error);

      // Act & Assert
      await expect(
        adminService.googleLoginCrm(mockRequest as ECoreReq, googleSigninDto),
      ).rejects.toThrow(error);

      // Verify method calls
      expect(adminService.verifyGoogleToken).toHaveBeenCalledWith(googleSigninDto.token);
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('should create a new user when user does not exist', async () => {
      // Arrange
      prismaService.user.findUnique = jest.fn().mockResolvedValue(null);

      // Act
      const result = await adminService.googleLoginCrm(mockRequest as ECoreReq, googleSigninDto);

      // Assert
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: mockGooglePayload.email,
          firstName: mockGooglePayload.given_name,
          lastName: mockGooglePayload.family_name,
          googleId: mockGooglePayload.sub,
          emailVerified: mockGooglePayload.email_verified,
          authProvider: 'GOOGLE',
        },
      });
      expect(jwtService.generateToken).toHaveBeenCalledWith(mockNewUser.id);
      expect(result).toEqual({
        _statuscode: HttpStatus.CREATED,
        token: mockJwtToken,
        email: mockNewUser.email,
        firstName: mockNewUser.firstName,
        lastName: mockNewUser.lastName,
        isProfileComplete: false,
      });
    });

    it('should throw HttpException when user is not associated with any organization', async () => {
      // Arrange - create a user with no organizations
      const userWithNoOrgs = {
        ...mockUser,
        organizationMembers: [], // Empty array - no organizations
      };

      // Override the user.findUnique mocks for this test
      prismaService.user.findUnique = jest
        .fn()
        .mockResolvedValueOnce(userWithNoOrgs) // First call in finding user
        .mockResolvedValueOnce(userWithNoOrgs); // Second call in validateUserStatus

      // Act & Assert
      await expect(
        adminService.googleLoginCrm(mockRequest as ECoreReq, googleSigninDto),
      ).rejects.toThrow(
        new HttpException(
          {
            message: 'USER_NOT_ASSOCIATED_WITH_ANY_ORGANIZATION',
          },
          203,
        ),
      );

      // Verify method calls
      expect(prismaService.user.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should throw HttpException when member user has no active subscription', async () => {
      // Arrange - create a user with no subscription
      const userWithNoSubscription = {
        id: 'user-id',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        emailVerified: true,
        phoneNumber: '1234567890',
        organizationMembers: [
          {
            userType: UserType.WORKER,
            organization: {
              id: 'org-id',
              name: 'Test Organization',
              subscription: null,
            },
          },
        ],
      };

      // Override the user.findUnique mocks for this test
      prismaService.user.findUnique = jest
        .fn()
        .mockResolvedValueOnce(userWithNoSubscription) // First call in finding user
        .mockResolvedValueOnce(userWithNoSubscription); // Second call in validateUserStatus

      // Act & Assert
      await expect(
        adminService.googleLoginCrm(mockRequest as ECoreReq, googleSigninDto),
      ).rejects.toThrow(
        new HttpException(
          {
            message: 'USER_PLAN_DEACTIVATED',
            statusCode: 400,
          },
          400,
        ),
      );

      // Verify method calls
      expect(prismaService.user.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should throw UnauthorizedException when non-owner user subscription is expired', async () => {
      // Mock the expired subscription
      prismaService.organizationSubscription.findUnique = jest.fn().mockResolvedValue({
        status: 'ACTIVE',
        endDate: new Date(Date.now() - 86400000), // Past date - expired
      });

      // Act & Assert
      await expect(
        adminService.googleLoginCrm(mockRequest as ECoreReq, googleSigninDto),
      ).rejects.toThrow(new UnauthorizedException('SUBSCRIPTION_EXPIRED'));
    });

    it('should skip subscription validation for OWNER user type', async () => {
      // Arrange - setup an owner user
      const ownerOrgMember = {
        ...mockOrgMember,
        userType: 'OWNER',
        organization: {
          ...mockOrgMember.organization,
          name: 'Test Organization',
          subdomain: 'test-org',
        },
      };

      // Mock the necessary service calls
      adminService.verifyGoogleToken = jest.fn().mockResolvedValue(mockGooglePayload);
      prismaService.user.findUnique = jest.fn().mockResolvedValue(mockUser);
      prismaService.organizationMember.findFirst = jest.fn().mockResolvedValue(ownerOrgMember);
      prismaService.user.update = jest.fn().mockResolvedValue({
        ...mockUser,
        googleId: mockGooglePayload.sub,
        emailVerified: true,
        lastLoginAt: new Date(),
      });

      // Mock the subdomain token generation
      const mockSubdomainTokenId = 'mock-subdomain-token-id';
      const mockSubdomainToken = 'mock-subdomain-token';
      jwtService.generateSubdomainToken = jest.fn().mockResolvedValue(mockSubdomainToken);

      // Make sure update is properly mocked
      prismaService.organizationMember.update = jest.fn().mockResolvedValue({
        userId: mockUser.id,
        organizationId: ownerOrgMember.organization.id,
        accessTokenCRMId: null,
        refreshTokenCRMId: mockSubdomainTokenId,
      });

      // Act
      const result = await adminService.googleLoginCrm(mockRequest as ECoreReq, googleSigninDto);

      // Assert
      expect(result).toEqual({
        _statuscode: HttpStatus.SUCCESS,
        subdomainToken: mockSubdomainToken,
        organizationSubdomain: ownerOrgMember.organization.subdomain,
      });

      // Verify method calls using toHaveBeenCalledWith instead of accessing mock.calls
      expect(prismaService.organizationMember.update).toHaveBeenCalledWith({
        where: {
          userId_organizationId: {
            userId: mockUser.id,
            organizationId: ownerOrgMember.organization.id,
          },
        },
        data: {
          accessTokenCRMId: null,
          refreshTokenCRMId: expect.any(String),
        },
      });

      expect(jwtService.generateSubdomainToken).toHaveBeenCalledWith(
        mockUser.id,
        ownerOrgMember.organization.id,
        expect.any(String),
      );
    });

    it('should successfully log in existing user with Google and update profile', async () => {
      // Using mockOrgMember with updated fields
      const mockOrgMember = {
        userId: 'user-id',
        organizationId: 'org-id',
        userType: 'WORKER',
        organization: {
          id: 'org-id',
          name: 'Test Organization',
          subdomain: 'test-org',
          subscription: {
            status: 'ACTIVE',
            endDate: new Date(Date.now() + 86400000),
            plan: {
              id: 'plan-id',
              name: 'Standard Plan',
            },
          },
        },
      };

      // Mock the necessary service calls
      adminService.verifyGoogleToken = jest.fn().mockResolvedValue(mockGooglePayload);
      prismaService.user.findUnique = jest.fn().mockResolvedValue(mockUser);
      prismaService.organizationMember.findFirst = jest.fn().mockResolvedValue(mockOrgMember);
      prismaService.user.update = jest.fn().mockResolvedValue({
        ...mockUser,
        googleId: mockGooglePayload.sub,
        emailVerified: true,
        lastLoginAt: new Date(),
      });

      // Mock the subdomain token generation
      const mockSubdomainTokenId = 'mock-subdomain-token-id';
      const mockSubdomainToken = 'mock-subdomain-token';
      jwtService.generateSubdomainToken = jest.fn().mockResolvedValue(mockSubdomainToken);

      // Make sure update is properly mocked
      prismaService.organizationMember.update = jest.fn().mockResolvedValue({
        userId: mockUser.id,
        organizationId: mockOrgMember.organization.id,
        accessTokenCRMId: null,
        refreshTokenCRMId: mockSubdomainTokenId,
      });

      // Act
      const result = await adminService.googleLoginCrm(mockRequest as ECoreReq, googleSigninDto);

      // Assert
      expect(result).toEqual({
        _statuscode: HttpStatus.SUCCESS,
        subdomainToken: mockSubdomainToken,
        organizationSubdomain: mockOrgMember.organization.subdomain,
      });

      // Verify method calls using toHaveBeenCalledWith instead of accessing mock.calls
      expect(prismaService.organizationMember.update).toHaveBeenCalledWith({
        where: {
          userId_organizationId: {
            userId: mockUser.id,
            organizationId: mockOrgMember.organization.id,
          },
        },
        data: {
          accessTokenCRMId: null,
          refreshTokenCRMId: expect.any(String),
        },
      });

      expect(jwtService.generateSubdomainToken).toHaveBeenCalledWith(
        mockUser.id,
        mockOrgMember.organization.id,
        expect.any(String),
      );
    });
  });

  describe('/edit-organization', () => {
    const mockUser = {
      userId: 'user-123',
      organizationId: 'org-123',
      userType: 'OWNER',
      adminRole: 'ADMIN',
      platform: 'WEBSITE',
    };

    const mockOrganization = {
      id: 'org-123',
      name: 'Test Org',
      subdomain: 'test-org',
      country: 'US',
      orgImageUrl: 'http://example.com/image.jpg',
      orgImageKey: 'image-key-123',
    };

    const mockFile = {
      path: 'temp/image.jpg',
    } as Express.Multer.File;

    const body: EditOrganizationDto = {
      orgName: 'Updated Org',
      orgSubdomain: 'updated-subdomain',
      orgCountry: 'India',
    };

    it('should throw UnauthorizedException when organization not found', async () => {
      // Arrange
      prismaService.organization.findUnique = jest.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(
        adminService.editOrganization(mockUser as RequestUser, body, null),
      ).rejects.toThrow(new UnauthorizedException('ORGANIZATION_NOT_FOUND'));
    });

    it('should throw UnauthorizedException when user is not authorized', async () => {
      // Mock organization exists
      prismaService.organization.findUnique = jest.fn().mockResolvedValue(mockOrganization);
      // Mock user not authorized
      prismaService.organizationMember.findFirst = jest.fn().mockResolvedValue(null);

      await expect(
        adminService.editOrganization(mockUser as RequestUser, body, null),
      ).rejects.toThrow('UNAUTHORIZED_ACCESS');
    });

    it('should throw BadRequestException when subdomain already exists', async () => {
      const dto = {
        ...body,
        orgSubdomain: 'existing-subdomain',
      };

      // Arrange
      prismaService.organization.findFirst = jest.fn().mockResolvedValue(mockOrganization);
      prismaService.organizationMember.findFirst = jest.fn().mockResolvedValue({
        userType: UserType.OWNER,
      });
      prismaService.organization.findUnique = jest.fn().mockResolvedValue(mockOrganization);

      // Act & Assert
      await expect(
        adminService.editOrganization(mockUser as RequestUser, dto, null),
      ).rejects.toThrow(new BadRequestException('SUBDOMAIN_ALREADY_EXISTS'));
    });

    it('should throw BadRequestException when organization name already exists', async () => {
      const dto = {
        organizationId: 'org-123',
        orgName: 'Existing Org',
      };

      // Arrange
      prismaService.organization.findFirst = jest.fn().mockResolvedValue(mockOrganization);
      prismaService.organizationMember.findFirst = jest.fn().mockResolvedValue({
        userType: UserType.OWNER,
      });
      prismaService.organization.findUnique = jest.fn().mockResolvedValue(mockOrganization);

      await expect(adminService.editOrganization(mockUser, dto, null)).rejects.toThrow(
        new BadRequestException('ORGANIZATION_ALREADY_EXISTS'),
      );
    });

    it('should successfully update organization without new image', async () => {
      const dto = {
        ...body,
        orgName: 'Updated Org',
        orgCountry: 'India',
      };

      const updatedOrg = {
        ...mockOrganization,
        name: dto.orgName,
        country: dto.orgCountry,
      };

      // Arrange
      prismaService.organization.findUnique = jest.fn().mockResolvedValue(mockOrganization);
      prismaService.organizationMember.findFirst = jest.fn().mockResolvedValue({
        userType: UserType.OWNER,
      });
      prismaService.organization.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.organization.update = jest.fn().mockResolvedValue(updatedOrg);

      const result = await adminService.editOrganization(mockUser as RequestUser, dto, null);

      expect(result).toEqual({
        organizationId: updatedOrg.id,
        orgName: updatedOrg.name,
        orgImage: updatedOrg.orgImageUrl,
        orgSubdomain: updatedOrg.subdomain,
        orgCountry: updatedOrg.country,
      });
    });

    it('should successfully update organization with new image', async () => {
      const dto = {
        ...body,
        orgName: 'Updated Org',
      };

      const newImageData = {
        secure_url: 'http://example.com/new-image.jpg',
        public_id: 'new-image-key-123',
      };

      const updatedOrg = {
        ...mockOrganization,
        name: body.orgName,
        orgImageUrl: newImageData.secure_url,
        orgImageKey: newImageData.public_id,
      };

      // Arrange
      prismaService.organization.findUnique = jest.fn().mockResolvedValue(mockOrganization);
      prismaService.organizationMember.findFirst = jest.fn().mockResolvedValue({
        userType: UserType.OWNER,
      });
      cloudinaryService.uploadImage = jest.fn().mockResolvedValue(newImageData);
      cloudinaryService.deleteImage = jest.fn().mockResolvedValue(true);
      prismaService.organization.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.organization.update = jest.fn().mockResolvedValue(updatedOrg);

      const result = await adminService.editOrganization(mockUser as RequestUser, dto, mockFile);

      expect(cloudinaryService.uploadImage).toHaveBeenCalled();
      expect(cloudinaryService.deleteImage).toHaveBeenCalled();
      expect(result.orgImage).toBe(newImageData.secure_url);
    });

    it('should allow manager to edit organization', async () => {
      const dto = {
        ...body,
        orgName: 'Updated Org',
      };

      // Arrange
      prismaService.organization.findUnique = jest.fn().mockResolvedValue(mockOrganization);
      prismaService.organizationMember.findFirst = jest.fn().mockResolvedValue({
        userType: UserType.MANAGER,
      });
      prismaService.organization.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.organization.update = jest.fn().mockResolvedValue({
        ...mockOrganization,
        name: dto.orgName,
      });

      const result = await adminService.editOrganization(mockUser as RequestUser, dto, null);
      expect(result.orgName).toBe(dto.orgName);
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

  describe('get-organization-detail', () => {
    const user: RequestUser = {
      organizationId: 'org-123',
      userId: 'user-123',
      userType: 'OWNER',
      adminRole: 'ADMIN',
      platform: 'WEBSITE',
    };

    it('should throw when organization is not found', () => {
      // Arrange
      prismaService.organization.findFirst = jest.fn().mockResolvedValue(null);

      // Act and assert
      expect(adminService.getOrganizationDetail(user)).rejects.toThrow(
        new UnauthorizedException('ORGANIZATION_NOT_FOUND'),
      );
    });

    it('should return organization detail', async () => {
      // Arrange
      const mockOrganization = {
        id: user.organizationId,
        name: 'Test Org',
        subdomain: 'test-org',
        country: 'US',
        orgImageUrl: 'http://example.com/image.jpg',
        orgImageKey: 'image-key-123',
      };
      prismaService.organization.findFirst = jest.fn().mockResolvedValue(mockOrganization);

      // Act
      const result = await adminService.getOrganizationDetail(user);

      // Assert
      expect(result).toEqual({
        organizationId: mockOrganization.id,
        orgName: mockOrganization.name,
        orgImage: mockOrganization.orgImageUrl,
        orgSubdomain: mockOrganization.subdomain,
        orgCountry: mockOrganization.country,
      });
    });
  });

  describe('organization-name-check', () => {
    const organizationNameCheckDto: OrganizationNameCheckDto = {
      orgName: 'Test Org',
    };

    const user: RequestUser = {
      organizationId: 'org-123',
      userId: 'user-123',
      userType: 'OWNER',
      adminRole: 'ADMIN',
      platform: 'WEBSITE',
    };

    it('should return true when organization name is available', async () => {
      prismaService.organization.findFirst = jest.fn().mockResolvedValue(null);

      const result = await adminService.organizationNameCheck(user, organizationNameCheckDto);

      expect(result).toEqual({ isAvailable: true });
    });

    it('should return false when organization name is unavailable', async () => {
      prismaService.organization.findFirst = jest.fn().mockResolvedValue({
        id: 'org-123',
        name: 'Test Org',
      });

      const result = await adminService.organizationNameCheck(user, organizationNameCheckDto);

      expect(result).toEqual({ isAvailable: false });
    });
  });
});
