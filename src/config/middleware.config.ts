import { resolve } from 'path';

import { json, urlencoded } from 'body-parser';
import * as compression from 'compression';
import * as express from 'express';
import { Express } from 'express';
import * as expressEjsLayouts from 'express-ejs-layouts';

import type { NestExpressApplication } from '@nestjs/platform-express';

export const setupMiddleware = (server: NestExpressApplication): void => {
  server.use(compression()); // Gzip compression
  server.use(json({ limit: '15mb' }));
  server.use(urlencoded({ extended: false }));
  server.use(express.json());

  // Setup static assets
  server.useStaticAssets(resolve('./uploads'));
  server.use('/uploads', express.static(resolve('./uploads')));

  // Setup EJS view engine
  const expressApp: Express = server.getHttpAdapter().getInstance();
  expressApp.set('view engine', 'ejs');
  expressApp.set('views', 'src/views');

  // Enable Express EJS layouts
  server.use(expressEjsLayouts);
};
