import { createMiddleware } from 'hono/factory';
import { randomUUID } from 'node:crypto';

export const requestLogger = createMiddleware(async (c, next) => {
  const requestId = randomUUID();
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  // Store request ID in context for use in handlers
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
