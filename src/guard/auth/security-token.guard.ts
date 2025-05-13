import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/services/prisma.service';

interface JwtPayload {
  id: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class SecurityTokenGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['authorization'];

    if (!token) {
      throw new UnauthorizedException('TOKEN_REQUIRED');
    }

    try {
      // Verify the token
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });

      if (!payload.id) {
        throw new UnauthorizedException('INVALID_PAYLOAD');
      }

      // Check if user exists and is not deleted
      const user = await this.prisma.user.findUnique({
        where: {
          id: payload.id,
          isDeleted: false,
        },
        select: {
          id: true,
          email: true,
        },
      });

      if (!user) {
        throw new BadRequestException('USER_NOT_FOUND');
      }

      request.userId = user.id;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      if (error?.name === 'TokenExpiredError') {
        throw new UnauthorizedException({
          message: 'TOKEN_EXPIRED',
        });
      }

      if (error?.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('TOKEN_MALFORMED');
      }

      throw new UnauthorizedException('Failed to validate security token');
    }
  }
}
