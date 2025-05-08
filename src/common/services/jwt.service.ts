import { Injectable, NotAcceptableException, UnauthorizedException } from '@nestjs/common';
import { JsonWebTokenError, JwtService, TokenExpiredError } from '@nestjs/jwt';

@Injectable()
export class TokenUtils {
  constructor(private readonly jwtService: JwtService) {}

  private getSecretsByPlatform(platform: string): { accessSecret: string; refreshSecret: string } {
    const platformSecrets = {
      WEBSITE: {
        accessSecret: process.env.WEB_ACCESS_SECRET,
        refreshSecret: process.env.WEB_REFRESH_SECRET,
      },
      EXTENSION: {
        accessSecret: process.env.EXTENSION_ACCESS_SECRET,
        refreshSecret: process.env.EXTENSION_REFRESH_SECRET,
      },
      APP: {
        accessSecret: process.env.APP_ACCESS_SECRET,
        refreshSecret: process.env.APP_REFRESH_SECRET,
      },
    };

    return platformSecrets[platform];
  }
  async generateTokens(
    user: { id: string; organizationId: string },
    platform: string,
    accessTokenExpiry: string,
    refreshTokenExpiry: string,
    loginTokenNonce: string,
    refreshTokenNonce: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Get platform secrets based on the provided platform type
    const { accessSecret, refreshSecret } = this.getSecretsByPlatform(platform);

    const accessToken = await this.jwtService.signAsync(
      {
        userId: user.id,
        organizationId: user.organizationId,
        platform: platform,
        accessTokenNonce: loginTokenNonce,
      },
      {
        expiresIn: accessTokenExpiry,
        secret: accessSecret,
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        userId: user.id,
        organizationId: user.organizationId,
        platform: platform,
        refreshTokenNonce: refreshTokenNonce,
      },
      {
        expiresIn: refreshTokenExpiry,
        secret: refreshSecret,
      },
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  async generateToken(userId: string): Promise<string> {
    const payload = {
      id: userId,
    };

    return this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '30m',
    });
  }

  async generateSubdomainToken(
    userId: string,
    organizationId: string,
    subdomainTokenId: string,
  ): Promise<string> {
    const payload = {
      userId: userId,
      organizationId: organizationId,
      subdomainTokenNounce: subdomainTokenId,
    };

    return this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '5m',
    });
  }

  async verifySubdomainToken(
    token: string,
  ): Promise<{ userId: string; organizationId: string; subdomainTokenNounce: string }> {
    try {
      // Verify the token
      const decodedToken = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });

      if (
        !decodedToken.subdomainTokenNounce ||
        !decodedToken.userId ||
        !decodedToken.organizationId
      ) {
        throw new UnauthorizedException('INVALID_TOKEN');
      }

      return {
        userId: decodedToken.userId,
        organizationId: decodedToken.organizationId,
        subdomainTokenNounce: decodedToken.subdomainTokenNounce,
      };
    } catch (error) {
      // Handle specific JWT verification errors
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedException('TOKEN_EXPIRED');
      }

      if (error instanceof JsonWebTokenError) {
        throw new UnauthorizedException('INVALID_TOKEN');
      }

      // For any other unexpected errors
      throw new UnauthorizedException('TOKEN_VERIFICATION_FAILED');
    }
  }

  async verifyRefreshToken(
    token: string,
    platform: string,
  ): Promise<{
    platform: string;
    refreshTokenNonce: string;
    userId: string;
    organizationId: string;
  }> {
    try {
      const { refreshSecret } = this.getSecretsByPlatform(platform);

      if (!refreshSecret) {
        throw new NotAcceptableException({
          message: 'INVALID_PLATFORM_CONFIG',
          data: { platform },
        });
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: refreshSecret,
      });

      return payload;
    } catch (error) {
      // Handle specific JWT verification errors
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedException('TOKEN_EXPIRED');
      }

      if (error instanceof JsonWebTokenError) {
        throw new UnauthorizedException('INVALID_TOKEN');
      }

      // For any other unexpected errors
      throw new UnauthorizedException('TOKEN_VERIFICATION_FAILED');
    }
  }
}
