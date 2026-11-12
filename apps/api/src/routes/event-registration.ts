import { Hono } from 'hono';
import { uploadEventRegistrationScreenshot } from '../event-registration/EventRegistrationUploadService.js';

type AppEnv = {
  Variables: Record<string, never>;
};

function httpError(error: unknown) {
  const err = error as { message?: string; code?: string; status?: number };
  const status = (err.status ?? 500) as 400 | 403 | 404 | 409 | 500 | 503;
  return {
    status,
    body: {
      error: err.message ?? 'Upload failed',
      code: err.code ?? 'upload_failed',
    },
  };
}

/**
 * Public knock.org.in helpers. Payment screenshots go to Cloudflare R2;
 * registration metadata continues to live in Firebase on the website.
 */
export const eventRegistrationRoutes = new Hono<AppEnv>();

eventRegistrationRoutes.post('/payment-screenshot', async c => {
  try {
    const contentType = c.req.header('content-type') ?? '';
    let mobile = '';
    let transactionId = '';
    let mime = 'image/jpeg';
    let filename = 'screenshot.jpg';
    let bytes: Buffer;

    if (contentType.includes('multipart/form-data')) {
      const body = await c.req.parseBody({ all: true });
      mobile = String(body.mobile ?? '');
      transactionId = String(body.transactionId ?? body.utr ?? '');
      const file = body.file;
      if (!(file instanceof File)) {
        throw Object.assign(new Error('Screenshot file is required'), {
          code: 'validation_error',
          status: 400,
        });
      }
      mime = file.type || 'image/jpeg';
      filename = file.name || filename;
      bytes = Buffer.from(await file.arrayBuffer());
    } else {
      const json = (await c.req.json()) as {
        mobile?: string;
        transactionId?: string;
        utr?: string;
        contentType?: string;
        filename?: string;
        dataBase64?: string;
      };
      mobile = String(json.mobile ?? '');
      transactionId = String(json.transactionId ?? json.utr ?? '');
      mime = String(json.contentType ?? 'image/jpeg');
      filename = String(json.filename ?? filename);
      const raw = String(json.dataBase64 ?? '');
      const cleaned = raw.includes(',') ? raw.split(',').pop()! : raw;
      if (!cleaned.trim()) {
        throw Object.assign(new Error('Screenshot file is required'), {
          code: 'validation_error',
          status: 400,
        });
      }
      bytes = Buffer.from(cleaned, 'base64');
    }

    const result = await uploadEventRegistrationScreenshot({
      mobile,
      transactionId,
      contentType: mime,
      filename,
      bytes,
    });

    return c.json({
      ok: true,
      storage: result.storage,
      bucket: result.bucket,
      key: result.key,
      contentType: result.contentType,
      byteSize: result.byteSize,
      screenshotUrl: result.screenshotUrl,
    });
  } catch (error) {
    const { status, body } = httpError(error);
    return c.json(body, status);
  }
});
