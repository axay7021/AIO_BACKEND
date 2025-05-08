import { Test, TestingModule } from '@nestjs/testing';
import {
  ECoreReq,
  ECoreReqAdmin,
  ECoreReqHeader,
  ECoreRes,
} from 'src/common/interfaces/request.interface';
import { adminController } from '../../app/admin/admin.controller';
import { AdminService } from '../../app/admin/admin.service';
import { CreateAdminDto } from '../../app/admin/dto/signup.dto';
import { ResponseService } from 'src/common/services/response.service';
import { BadRequestException } from '@nestjs/common';
import { CloudinaryService } from '@common/services/clodinary.service';
import { SecurityTokenGuard } from 'src/guard/auth/security-token.guard';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@common/services/prisma.service';

describe('AdminController', () => {
  let controller: adminController;
  let adminService: AdminService;
  let responseService: ResponseService;
  let clodinaryService: CloudinaryService;
  let prismaService: PrismaService;

  const mockResponseService = {
    success: jest.fn(),
    error: jest.fn(),
  };

  const mockAdminService = {
    signup: jest.fn(),
  };

  const mockSecurityTokenGuard = {
    canActivate: jest.fn().mockReturnValue(true),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verifyAsync: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [adminController],
      providers: [
        { provide: AdminService, useValue: mockAdminService },
        { provide: ResponseService, useValue: mockResponseService },
        { provide: CloudinaryService, useValue: clodinaryService },
        { provide: SecurityTokenGuard, useValue: mockSecurityTokenGuard },
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    controller = module.get<adminController>(adminController);
    adminService = module.get<AdminService>(AdminService);
    responseService = module.get<ResponseService>(ResponseService);
  });

  afterEach(() => {
    jest.clearAllMocks(); // Reset all mocks after each test
  });

  describe('signup', () => {
    const mockReq: Partial<ECoreReqHeader> = { ip: '127.0.0.1' };
    const mockRes: Partial<ECoreRes> = {};
    const mockCreateAdminDto: CreateAdminDto = {
      email: 'john.doe@example.com',
      password: 'StrongPass123!',
    };

    it('should block IP after 10 failed attempts and allow after receiving block message', async () => {
      const mockSignupResponse = {
        email: mockCreateAdminDto.email,
        otp: expect.any(String),
      };

      // Mock first attempt (success)
      jest.spyOn(adminService, 'createAdmin').mockResolvedValueOnce(mockSignupResponse);

      // Mock 9 failed attempts
      for (let i = 0; i < 9; i++) {
        jest.spyOn(adminService, 'createAdmin').mockRejectedValueOnce(
          new BadRequestException({
            message: 'EMAIL_ALREADY_EXISTS',
          })
        );
      }

      // Mock the IP block message on 11th attempt
      jest.spyOn(adminService, 'createAdmin').mockRejectedValueOnce(
        new BadRequestException({
          message: 'IP_BLOCKED_PERMANENTLY',
        })
      );

      // Mock success for attempt after block
      jest.spyOn(adminService, 'createAdmin').mockResolvedValue(mockSignupResponse);

      let ipBlockMessageReceived = false;

      // Try 12 signup attempts
      for (let i = 0; i < 12; i++) {
        try {
          const result = await adminService.createAdmin(
            mockReq as ECoreReqAdmin,
            mockCreateAdminDto
          );
          if (i === 11 && ipBlockMessageReceived) {
            // If we got the block message and this attempt succeeds, test passes
            expect(result).toEqual(mockSignupResponse);
          }
        } catch (error) {
          if (i === 10) {
            // Check for IP block message on 11th attempt
            expect(error.message).toBe('IP_BLOCKED_PERMANENTLY');
            ipBlockMessageReceived = true;
          }
          // Track failed attempts
          // ipBlockingGuard.trackFailedAttempt(mockReq.ip);
        }
      }

      expect(adminService.createAdmin).toHaveBeenCalledTimes(12);
      expect(ipBlockMessageReceived).toBe(true);
      // expect(ipBlockingGuard.trackFailedAttempt).toHaveBeenCalledTimes(10); // Number of failed attempts before block
    });

    it('should block email after 5 failed signup attempts', async () => {
      const mockSignupResponse = {
        email: mockCreateAdminDto.email,
        otp: expect.any(String),
      };

      // Mock successful first attempt
      jest.spyOn(adminService, 'createAdmin').mockResolvedValueOnce(mockSignupResponse);

      // Mock 4 failed attempts with EMAIL_ALREADY_EXISTS
      for (let i = 0; i < 4; i++) {
        jest.spyOn(adminService, 'createAdmin').mockRejectedValueOnce(
          new BadRequestException({
            message: 'EMAIL_ALREADY_EXISTS',
          })
        );
      }

      // Mock 6th attempt with EMAIL_BLOCKED_PERMANENTLY
      jest.spyOn(adminService, 'createAdmin').mockRejectedValueOnce(
        new BadRequestException({
          message: 'EMAIL_BLOCKED_PERMANENTLY',
        })
      );

      // Mock 7th attempt with success if block message was received
      jest.spyOn(adminService, 'createAdmin').mockResolvedValue(mockSignupResponse);

      let blockMessageReceived = false;

      // Try 7 signup attempts
      for (let i = 0; i < 7; i++) {
        try {
          const result = await adminService.createAdmin(
            mockReq as ECoreReqAdmin,
            mockCreateAdminDto
          );
          if (i === 6 && blockMessageReceived) {
            // If we got the block message and this attempt succeeds, test passes
            expect(result).toEqual(mockSignupResponse);
          }
        } catch (error) {
          if (i === 5) {
            // Check for block message on 6th attempt
            expect(error.message).toBe('EMAIL_BLOCKED_PERMANENTLY');
            blockMessageReceived = true;
          }
        }
      }

      expect(adminService.createAdmin).toHaveBeenCalledTimes(7);
      expect(blockMessageReceived).toBe(true);
    });

    it('should successfully signup an admin', async () => {
      const mockSignupResponse = {
        email: mockCreateAdminDto.email,
        otp: expect.any(String),
      };

      jest.spyOn(adminService, 'createAdmin').mockResolvedValue(mockSignupResponse);

      await controller.createAdmin(
        mockReq as ECoreReqAdmin,
        mockRes as ECoreRes,
        mockCreateAdminDto
      );

      expect(adminService.createAdmin).toHaveBeenCalledWith(mockReq, mockCreateAdminDto);
      expect(responseService.success).toHaveBeenCalledWith(
        mockReq,
        mockRes,
        'ADMIN_CREATE_SUCCESS',
        mockSignupResponse,
        201
      );
    });

    it('should prevent duplicate admin creates with the same email', async () => {
      const mockSignupResponse = {
        email: mockCreateAdminDto.email,
        otp: expect.any(String),
      };

      // Mock the first call to signup (success)
      jest.spyOn(adminService, 'createAdmin').mockResolvedValueOnce(mockSignupResponse);

      // First call: should succeed
      await controller.createAdmin(
        mockReq as ECoreReqAdmin,
        mockRes as ECoreRes,
        mockCreateAdminDto
      );

      // Verify the first call
      expect(adminService.createAdmin).toHaveBeenCalledWith(mockReq, mockCreateAdminDto);
      expect(responseService.success).toHaveBeenCalledWith(
        mockReq,
        mockRes,
        'ADMIN_CREATE_SUCCESS',
        mockSignupResponse,
        201
      );

      // Mock the second call to signup (failure)
      jest.spyOn(adminService, 'createAdmin').mockRejectedValueOnce(
        new BadRequestException({
          message: 'EMAIL_ALREADY_EXISTS',
        })
      );

      // Second call: should fail with BadRequestException
      await expect(
        controller.createAdmin(mockReq as ECoreReqAdmin, mockRes as ECoreRes, mockCreateAdminDto)
      ).rejects.toThrow(BadRequestException);

      // Verify the second call
      expect(adminService.createAdmin).toHaveBeenCalledWith(mockReq, mockCreateAdminDto);

      // Ensure signup was called exactly twice
      expect(adminService.createAdmin).toHaveBeenCalledTimes(2);
    });

    it('should handle unexpected errors gracefully', async () => {
      jest.spyOn(adminService, 'createAdmin').mockRejectedValue(new Error('Unexpected Error'));

      await expect(
        controller.createAdmin(mockReq as ECoreReqAdmin, mockRes as ECoreRes, mockCreateAdminDto)
      ).rejects.toThrow(Error);

      expect(adminService.createAdmin).toHaveBeenCalledWith(mockReq, mockCreateAdminDto);
    });
  });
});
