import { createMiddleware } from 'hono/factory';
import { randomUUID } from 'node:crypto';

export type RequestLoggerEnv = {
  Variables: {
    requestId: string;
  };
};

export const requestLogger = createMiddleware<RequestLoggerEnv>(async (c, next) => {
  const requestId = randomUUID();
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  c.set('requestId', requestId);

  console.log(
    JSON.stringify({
      type: 'request_start',
      requestId,
      method,
      path,
      timestamp: new Date().toISOString(),
    }),
  );

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  console.log(
    JSON.stringify({
      type: 'request_end',
      requestId,
      method,
      path,
      status,
      duration,
      timestamp: new Date().toISOString(),
    }),
  );
});
