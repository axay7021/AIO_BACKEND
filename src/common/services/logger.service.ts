import * as path from 'node:path';

import { Injectable } from '@nestjs/common';
import * as expressWinston from 'express-winston';
import { BaseLoggerOptions, RequestFilter } from 'express-winston';
import { format, transport } from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';

import { ECoreReq } from '../interfaces/request.interface';

@Injectable()
export class LoggingService {
  private readonly requestWhitelist = [
    'fullURL',
    'headers',
    'method',
    'httpVersion',
    'query',
    'body',
    'params',
    'user',
  ];

  private readonly requestFilter: RequestFilter = (req, propName) => {
    if (propName === 'fullURL') return this.getFullURL(req);
    if (propName === 'user') return req.user?._id;
    if (propName === 'body') return req.body;
    if (propName === 'headers') {
      return {
        host: req.headers.host,
        contentType: req.headers['content-type'],
        acceptLanguage: req.headers['accept-language'],
        language: req.headers['language'],
        userAgent: req.headers['user-agent'],
      };
    }
    return req[propName];
  };

  private getFullURL<T extends Pick<ECoreReq, 'protocol' | 'hostname' | 'originalUrl'>>(
    req: T,
  ): string {
    return `${this.getBaseURL(req)}${req.originalUrl}`;
  }

  private getBaseURL<T extends Pick<ECoreReq, 'protocol' | 'hostname'>>(req: T): string {
    return `${req.protocol}://${req.hostname}`;
  }

  private readonly commonOptions: BaseLoggerOptions = {
    statusLevels: true,
    expressFormat: true,
    requestWhitelist: this.requestWhitelist,
    requestFilter: this.requestFilter,
    format: format.combine(format.timestamp(), format.json()),
  };

  // Access logger (as per old setup)
  private createDailyRotateTransport(
    logDir: string,
    logRetention: string,
    compression = false,
  ): DailyRotateFile {
    return new DailyRotateFile({
      dirname: path.join(process.cwd(), 'logs', logDir),
      filename: `${logDir}.log`,
      datePattern: '',
      frequency: 'never', // Prevent splitting based on time
      level: 'info',
      format: format.combine(format.timestamp(), format.json()),
      zippedArchive: compression,
      maxFiles: logRetention,
    });
  }

  private getTransports(env: string): transport[] {
    const transports = [];

    switch (env) {
      case 'access':
        transports.push(this.createDailyRotateTransport('access', '30d', true));
        break;
      case 'combined':
        transports.push(this.createDailyRotateTransport('combined', '14d'));
        break;
      case 'error':
        transports.push(this.createDailyRotateTransport('error', '7d', true));
        break;
      case 'access-combined':
        transports.push(this.createDailyRotateTransport('access', '30d', true));
        transports.push(this.createDailyRotateTransport('combined', '14d'));
        break;
      case 'access-error':
        transports.push(this.createDailyRotateTransport('access', '30d ', true));
        transports.push(this.createDailyRotateTransport('error', '7d', true));
        break;
      case 'combined-error':
        transports.push(this.createDailyRotateTransport('combined', '14d'));
        transports.push(this.createDailyRotateTransport('error', '7d', true));
        break;
      case 'access-combined-error':
        transports.push(this.createDailyRotateTransport('access', '30d', true));
        transports.push(this.createDailyRotateTransport('combined', '14d'));
        transports.push(this.createDailyRotateTransport('error', '7d', true));
        break;
      default:
        transports.push(this.createDailyRotateTransport('access', '30d', true));
    }

    return transports;
  }

  // Access logger
  accessLogger = expressWinston.logger({
    ...this.commonOptions,
    transports: this.getTransports('access'),
  });

  // Combined logger
  combinedLogger = expressWinston.logger({
    ...this.commonOptions,
    transports: this.getTransports('combined'),
  });

  // Error logger
  errorLogger = expressWinston.errorLogger({
    level: (_, res, err) => {
      if (err && 'statusCode' in err && typeof err.statusCode === 'number') {
        return err.statusCode.toString().startsWith('5') ? 'error' : 'info';
      }
      return 'info';
    },
    transports: this.getTransports('error'),
    requestWhitelist: this.requestWhitelist,
    requestFilter: this.requestFilter,
  });
}
