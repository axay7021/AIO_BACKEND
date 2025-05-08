import { NestFactory } from '@nestjs/core';
import { I18nService } from 'nestjs-i18n';

import { AppModule } from './app.module';
import { ValidationExceptionFilter } from './common/filters/validationException.filter';
import { LoggingService } from './common/services/logger.service';
import { setupMiddleware } from './config/middleware.config';
import { setupValidation } from './config/validation.config';
import { ResponseService } from './common/services/response.service';

import type { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const loggingService = app.get(LoggingService);

  // Access Logger - Logs all requests (2xx, 3xx, 4xx, 5xx)
  app.use(loggingService.accessLogger);

  // Combined Logger - Logs 3xx, 4xx, and 5xx (warnings and above)
  app.use(loggingService.combinedLogger);

  // Error Logger - Logs errors (5xx and critical issues)
  app.use(loggingService.errorLogger);
  // Set up middleware
  setupMiddleware(app); // Pass the NestExpressApplication instance here

  app.enableCors({
    allowedHeaders: '*',
    origin: '*',
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  // Global Validation setup
  app.useGlobalPipes(setupValidation());

  // Global Exception Filter
  const responseService = app.get<ResponseService>(ResponseService);
  const i18nService = app.get<I18nService>(I18nService);
  app.useGlobalFilters(new ValidationExceptionFilter(i18nService, responseService));
  await app.listen(process.env.PORT || 3000);
}
bootstrap();
