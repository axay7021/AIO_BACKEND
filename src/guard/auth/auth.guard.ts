import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JsonWebTokenError, JwtService, TokenExpiredError } from '@nestjs/jwt';
import { PrismaService } from '../../common/services/prisma.service';
import { ECoreReq } from '@common/interfaces/request.interface';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private prismaService: PrismaService,
  ) {}

  private getSecretByPlatform(platform: string): string {
    const platformSecrets = {
      WEBSITE: process.env.WEB_ACCESS_SECRET,
      EXTENSION: process.env.EXTENSION_ACCESS_SECRET,
      APP: process.env.APP_ACCESS_SECRET,
    };

    return platformSecrets[platform];
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('TOKEN_REQUIRED');
    }

    try {
      // First, decode without verification to get the platform
      const decoded = this.jwtService.decode(token);
      if (!decoded || typeof decoded !== 'object' || !decoded.platform) {
        throw new UnauthorizedException('INVALID_TOKEN_STRUCTURE');
      }

      const { platform } = decoded;
      const validPlatforms = ['WEBSITE', 'EXTENSION', 'APP'];

      if (!validPlatforms.includes(platform)) {
        throw new UnauthorizedException('INVALID_PLATFORM');
      }

      // Get the correct secret for this platform
      const secret = this.getSecretByPlatform(platform);

      if (!secret) {
        throw new UnauthorizedException('PLATFORM_CONFIGURATION_ERROR');
      }

      // Verify the token with the platform-specific secret
      const payload = await this.jwtService.verifyAsync(token, { secret });

      // Check if token has required fields
      if (!payload.userId || !payload.organizationId || !payload.accessTokenNonce) {
        throw new UnauthorizedException('TOKEN_MISSING_REQUIRED_FIELDS');
      }

      // console.log('payload', payload);

      // Attach user and organization data to request
      request.user = {
        userId: payload.userId,
        organizationId: payload.organizationId,
        platform: platform,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // Handle specific JWT errors
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedException('TOKEN_EXPIRED');
      }

      if (error instanceof JsonWebTokenError) {
        throw new UnauthorizedException('INVALID_TOKEN');
      }

      // Handle any other unexpected errors
      throw new UnauthorizedException('AUTHENTICATION_FAILED');
    }
  }

  private extractTokenFromHeader(request: ECoreReq): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
