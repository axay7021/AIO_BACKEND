import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';

import { LoggingService } from './common/services/logger.service';
import { ResponseService } from './common/services/response.service';
import { i18nConfig } from './config/i18n.config';
import { MulterConfig } from './config/multer.config';
import { adminModule } from './app/admin/admin.module';

// import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { DepartmentModule } from './app/department/department.module';
import { ConfigModule } from '@nestjs/config';
console.log({
  envFilePath: `.env.${process.env.NODE_ENV}`,
});
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.env.${process.env.NODE_ENV}`,
      isGlobal: true,
    }),
    i18nConfig,
    MulterModule.register(MulterConfig),
    adminModule,
    DepartmentModule,
  ],
  providers: [ResponseService, LoggingService],
})
/**
 * The root module of the application.
 *
 * The `AppModule` class is the main entry point for the NestJS application.
 * It is used to organize the application structure and bring together various
 * modules, controllers, and providers.
 */
export class AppModule {}
