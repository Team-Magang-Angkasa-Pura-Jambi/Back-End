import express, { json, urlencoded } from 'express';
import cors from 'cors';

import * as ErrorHandler from '../middleware/errorHandler.js';
import { logger } from './express.js';
import { corsOptions } from './cors.js';
import apiV2 from '../routes/api/v2/index.js';

import { serverLoggerService } from '../modules/system_monitor/server_logger.service.js';

export const app = express();

app.use(cors(corsOptions));
app.use(logger);
app.use(json());
app.use(urlencoded({ extended: false }));
app.set('view engine', 'ejs');

// HTTP Monitoring Logger Middleware (Captures Request, Response, and Endpoint)
app.use((req, res, next) => {
  const start = Date.now();
  let capturedResponseBody: any = null;

  const originalJson = res.json;
  const originalSend = res.send;

  res.json = function (body: any) {
    capturedResponseBody = body;
    return originalJson.call(this, body);
  };

  res.send = function (body: any) {
    if (!capturedResponseBody) {
      try {
        capturedResponseBody = typeof body === 'string' ? JSON.parse(body) : body;
      } catch {
        capturedResponseBody = typeof body === 'string' ? body.slice(0, 1000) : '[Raw Data]';
      }
    }
    return originalSend.call(this, body);
  };

  const originalEnd = res.end;
  res.end = function (...args: any[]) {
    const durationMs = Date.now() - start;
    const statusCode = res.statusCode;

    // Avoid self-logging system-monitor endpoints to prevent infinite loop
    if (!req.originalUrl.includes('/system-monitor/logs') && !req.originalUrl.includes('/system-monitor/metrics')) {
      const level = statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'HTTP';
      const message = `${req.method} ${req.originalUrl} [${statusCode}] (${durationMs}ms)`;

      serverLoggerService.log(level, message, 'HTTPRouter', {
        statusCode,
        durationMs,
        endpoint: req.originalUrl,
        request: {
          method: req.method,
          url: req.originalUrl,
          ip: req.ip || req.socket.remoteAddress,
          headers: {
            'user-agent': req.headers['user-agent'],
            'content-type': req.headers['content-type'],
            'authorization': req.headers['authorization'] ? 'Bearer [Active Token]' : undefined,
          },
          query: req.query,
          params: req.params,
          body: req.method !== 'GET' ? req.body : undefined,
        },
        response: {
          statusCode,
          durationMs,
          body: capturedResponseBody,
        },
      });
    }

    return (originalEnd as any).apply(res, args);
  };

  next();
});

apiV2(app);

app.use(ErrorHandler.handleNotFound);
app.use(ErrorHandler.errorHandler);
