// import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
// import { Request, Response, NextFunction } from 'express';
// // import { logger } from '../services/logger.service';

// @Injectable()
// export class LoggerMiddleware implements NestMiddleware {
//   use(req: Request, res: Response, next: NextFunction) {
//     logger.log(
//       `${req.method}:${req.originalUrl} ${res.statusCode} body ${JSON.stringify(
//         req.body,
//       )}`,
//     );
//     next();
//   }
// }
