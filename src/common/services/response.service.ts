import { Injectable, Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

import {
  CustomHeaders,
  ECoreReq,
  ECoreReqHeader,
  ECoreRes,
  SupportedLanguages,
} from '../interfaces/request.interface';
import { ErrorResponse, SuccessResponse } from '../interfaces/response.interface';

@Injectable()
export class ResponseService {
  private readonly logger = new Logger(ResponseService.name);
  constructor(private readonly i18n: I18nService) {}

  async error(
    req: ECoreReq,
    res: ECoreRes,
    msg: string,
    statusCode: number,
    data?: object,
  ): Promise<ECoreRes> {
    const headers: CustomHeaders = req.headers as ECoreReqHeader;
    const language: SupportedLanguages = headers.language ? headers.language : 'en'; //-
    console.log('Data', data);
    // Format the timestamp consistently
    const timestamp = new Date().toUTCString();
    // console.log('req===>', req);//-
    //+
    // Create the error response object
    const response: ErrorResponse = {
      success: false,
      statusCode,
      message: await this.translateMessage(msg, language),
      data: data,
    };

    const logMessage = typeof msg === 'object' ? JSON.stringify(msg) : msg;

    // Log the error
    this.logger.error(`[${timestamp}] ${req.method}:${req.originalUrl} ${logMessage}`);

    return res.status(statusCode).json(response);
  }

  async success(
    req: ECoreReq,
    res: ECoreRes,
    msg: string,
    data: object,
    statusCode: number,
  ): Promise<ECoreRes> {
    try {
      const headers: CustomHeaders = req.headers as ECoreReqHeader;
      const language: SupportedLanguages = headers.language ? headers.language : 'en';
      if (typeof msg === 'string') {
        msg = await this.translateMessage(msg, language);
      }
      console.log('message==>', msg);
      console.log('language==>', language);

      const response: SuccessResponse = {
        success: true,
        statusCode,
        message: msg,
        data,
      };

      return res.status(statusCode).json(response);
    } catch (error) {
      console.log(`\nsuccess error ->> `, error);
    }
  }

  async translateMessage(key: string, language: string): Promise<string> {
    try {
      console.log('Key==>', key);
      const message = this.i18n.translate(`common.${key}`, {
        lang: language,
      });
      return message;
    } catch (error) {
      this.logger.warn(`Translation not found for key: ${key}, language: ${language}`);
      console.log('error==>', error);
      return key; // Fallback to key if translation not found
    }
  }
}
