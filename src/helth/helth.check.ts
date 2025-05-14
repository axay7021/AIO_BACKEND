import { Controller, Get, Module } from '@nestjs/common';
import { PrismaService } from '@common/services/prisma.service';

@Controller('health')
export class HealthCheckController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('check')
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type,@typescript-eslint/explicit-module-boundary-types
  async check() {
    console.log('Health check initiated');
    let dbState = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbState = 'up';
    } catch (e) {
      dbState = 'down';
    }
    return {
      server: 'up',
      database: dbState,
    };
  }
}

@Module({
  controllers: [HealthCheckController],
  providers: [PrismaService],
  // exports: [HealthCheckController], // REMOVE this line
})
export class HealthCheckModule {}
