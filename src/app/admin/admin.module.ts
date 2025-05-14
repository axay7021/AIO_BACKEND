import { Module } from '@nestjs/common';
import { ValidationExceptionFilter } from '@common/filters/validationException.filter';
import { PrismaService } from '@common/services/prisma.service';
import { ResponseService } from '@common/services/response.service';
import { adminController } from './admin.controller';
import { AdminService } from './admin.service';
import { HashingService } from 'src/common/services/hashing.service';
import { IPBlockingGuard } from 'src/guard/common/ip-blocking.guard';
import { EmailBlockingGuard } from 'src/guard/nonAuth/email-blocking.guard';
import { EmailService } from '@common/services/email.service';
import { TokenUtils } from '@common/services/jwt.service';
import { JwtService } from '@nestjs/jwt';
import { CloudinaryService } from '@common/services/clodinary.service';
import { SecurityTokenGuard } from 'src/guard/auth/security-token.guard';

@Module({
  controllers: [adminController],
  providers: [
    ResponseService,
    ValidationExceptionFilter,
    PrismaService,
    AdminService,
    HashingService,
    IPBlockingGuard,
    EmailBlockingGuard,
    SecurityTokenGuard,
    EmailService,
    TokenUtils,
    JwtService,
    CloudinaryService,
  ],
})
export class adminModule {}
