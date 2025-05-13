import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { ECoreRes } from '../interfaces/request.interface';
import { ResponseService } from '../services/response.service';

// Define a more comprehensive error message interface
interface ValidationErrorMessage {
  message: string[];
  error: string;
  statusCode: number;
  data?: object;
}

@Catch(HttpException)
export class ValidationExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly i18n: I18nService,
    private readonly responseService: ResponseService
  ) {}

  async catch(exception: HttpException, host: ArgumentsHost): Promise<ECoreRes> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const status = exception.getStatus();
    // const lang = (request.headers.language as string) || 'en';

    // Type cast the error response
    const errorResponse = exception.getResponse() as ValidationErrorMessage;
    // Handle message array or string
    let message: string;
    if (Array.isArray(errorResponse.message)) {
      message = errorResponse.message[0] ?? 'Validation failed';
    } else {
      message = errorResponse.message ?? 'Validation failed';
    }

    // return data if available
    const data = errorResponse?.data ?? null;

    try {
      return this.responseService.error(request, response, message, status, data);
    } catch (error) {
      return this.responseService.error(
        request,
        response,
        error instanceof Error ? error.message : 'Unknown error occurred',
        status,
        data
      );
    }
  }
}

// import {
//   ArgumentsHost,
//   Catch,
//   ExceptionFilter,
//   HttpException,
// } from "@nestjs/common";
// import { I18nService } from "nestjs-i18n";
// import { ECoreRes } from "../interfaces/request.interface";
// import { ResponseService } from "../services/response.service";

// interface errorMessage {
//   message: string[];
//   error: string;
//   statusCode: number;
// }

// @Catch(HttpException)
// export class ValidationExceptionFilter implements ExceptionFilter {
//   constructor(
//     private readonly i18n: I18nService,
//     private readonly responseService: ResponseService
//   ) {}

//   async catch(
//     exception: HttpException,
//     host: ArgumentsHost
//   ): Promise<ECoreRes> {
//     const ctx = host.switchToHttp();
//     const response = ctx.getResponse();
//     const request = ctx.getRequest();
//     const status = exception.getStatus();
//     // console.log("response======>", response);
//     const lang = (request.headers.language as string) || "en";
//     const errorResponse: errorMessage = exception.getResponse();
//     console.log(errorResponse);
//     // let message = response.message || 'Validation failed';
//     let message = errorResponse?.message[0] ?? "Validation failed";

//     // if (typeof message !== "string") {
//     //   message = message[0];
//     // }
//     console.log({ exception });
//     try {
//       return this.responseService.error(request, response, message, status);
//       // return response.status(status).json({
//       //   success: false,
//       //   statusCode: status,
//       //   request: {
//       //     ip: request.ip ?? null,
//       //     method: request.method,
//       //     url: request.originalUrl,
//       //   },
//       //   message: translatedMessage,
//       //   data: null,
//       // });
//     } catch (error) {
//       console.log("error==>", error);
//       return this.responseService.error(
//         request,
//         response,
//         error.message,
//         status
//       );
//       // return response.status(status).json({
//       //   success: false,
//       //   statusCode: status,
//       //   request: {
//       //     ip: request.ip ?? null,
//       //     method: request.method,
//       //     url: request.originalUrl,
//       //   },
//       //   message: error.message,
//       //   data: null,
//       // });
//     }
//   }
// }
