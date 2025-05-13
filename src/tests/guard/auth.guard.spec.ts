import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '../../guard/auth/auth.guard';
import { PrismaService } from '../../common/services/prisma.service';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: JwtService;

  // Mock data
  const mockToken = 'valid.jwt.token';
  const mockUserId = 'user123';
  const mockOrgId = 'org123';
  const mockAccessTokenNonce = 'nonce123';

  const mockContext = {
    switchToHttp: (): { getRequest: () => { headers: { authorization: string } } } => ({
      getRequest: () => ({
        headers: {
          authorization: `Bearer ${mockToken}`,
        },
      }),
    }),
  } as ExecutionContext;

  const baseMockOrganizationMember = {
    id: 'member123',
    userId: mockUserId,
    organizationId: mockOrgId,
    isDefaultOrganization: false,
    accessTokenCRMId: mockAccessTokenNonce,
    refreshTokenCRMId: 'refresh123',
    accessTokenEXTENTIONId: 'ext123',
    refreshTokenEXTENTIONId: 'extr123',
    accessTokenAPPId: 'app123',
    refreshTokenAPPId: 'appr123',
    createdAt: new Date(),
    updatedAt: new Date(),
    organization: {
      isActive: true,
      deleted: false,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        {
          provide: JwtService,
          useValue: {
            decode: jest.fn(),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            organizationMember: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
    jwtService = module.get<JwtService>(JwtService);

    // Setup environment variables
    process.env.WEB_ACCESS_SECRET = 'web-secret';
    process.env.EXTENSION_ACCESS_SECRET = 'extension-secret';
    process.env.APP_ACCESS_SECRET = 'app-secret';
  });

  describe('canActivate', () => {
    it('should allow access with valid website token', async () => {
      // Arrange
      const mockDecodedToken = {
        platform: 'WEBSITE',
        userId: mockUserId,
        organizationId: mockOrgId,
        accessTokenNonce: mockAccessTokenNonce,
      };

      (jwtService.decode as jest.Mock).mockReturnValue(mockDecodedToken);
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(mockDecodedToken);

      // Act
      const result = await guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should allow access with valid app token', async () => {
      // Arrange
      const appTokenNonce = 'app-token-nonce';
      const mockDecodedToken = {
        platform: 'APP',
        userId: mockUserId,
        organizationId: mockOrgId,
        accessTokenNonce: appTokenNonce,
      };

      const mockOrgMemberForApp = {
        ...baseMockOrganizationMember,
        accessTokenAPPId: appTokenNonce, // Make sure this matches the token nonce
      };

      (jwtService.decode as jest.Mock).mockReturnValue(mockDecodedToken);
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(mockDecodedToken);

      // Act
      const result = await guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });
    it('should allow access with valid extension token', async () => {
      // Arrange
      const extensionToken = 'extesnion-token-nonce';
      const mockDecodedToken = {
        platform: 'EXTENSION',
        userId: mockUserId,
        organizationId: mockOrgId,
        accessTokenNonce: extensionToken,
      };

      const mockOrgMemberForExtension = {
        ...baseMockOrganizationMember,
        accessTokenEXTENTIONId: extensionToken, // Make sure this matches the token nonce
      };

      (jwtService.decode as jest.Mock).mockReturnValue(mockDecodedToken);
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(mockDecodedToken);

      // Act
      const result = await guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should throw UnauthorizedException when token is missing', async () => {
      // Arrange
      const mockContext = {
        switchToHttp: (): { getRequest: () => { headers: Record<string, string> } } => ({
          getRequest: () => ({
            headers: {},
          }),
        }),
      } as ExecutionContext;

      // Act & Assert
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        new UnauthorizedException('TOKEN_REQUIRED')
      );
    });

    it('should throw UnauthorizedException for invalid platform', async () => {
      // Arrange
      const mockDecodedToken = {
        platform: 'INVALID_PLATFORM',
        userId: mockUserId,
        organizationId: mockOrgId,
        accessTokenNonce: mockAccessTokenNonce,
      };

      (jwtService.decode as jest.Mock).mockReturnValue(mockDecodedToken);

      // Act & Assert
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        new UnauthorizedException('INVALID_PLATFORM')
      );
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      // Arrange
      const mockDecodedToken = {
        platform: 'WEBSITE',
        userId: mockUserId,
        organizationId: mockOrgId,
        accessTokenNonce: mockAccessTokenNonce,
      };

      (jwtService.decode as jest.Mock).mockReturnValue(mockDecodedToken);
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(mockDecodedToken);

      // Act & Assert
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        new UnauthorizedException('USER_ACCOUNT_NOT_ACTIVE')
      );
    });

    it('should throw UnauthorizedException for token nonce mismatch', async () => {
      // Arrange
      const mockDecodedToken = {
        platform: 'WEBSITE',
        userId: mockUserId,
        organizationId: mockOrgId,
        accessTokenNonce: 'different-nonce',
      };

      (jwtService.decode as jest.Mock).mockReturnValue(mockDecodedToken);
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(mockDecodedToken);

      // Act & Assert
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        new UnauthorizedException('ACCESS_TOKEN_NONCE_MISMATCH')
      );
    });
  });
});
