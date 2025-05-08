import { Module } from '@nestjs/common';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';
import { ResponseService } from '@common/services/response.service';
import { PrismaService } from '@common/services/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  controllers: [DepartmentController],
  providers: [DepartmentService, ResponseService, PrismaService, JwtService],
})
export class DepartmentModule {}
