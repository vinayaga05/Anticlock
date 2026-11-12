import {
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

function eventRegistrationBucket() {
  return (
    process.env.R2_BUCKET_EVENT_REGISTRATION?.trim() ||
    'anticlock-private-documents'
  );
}

function r2Client() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const endpoint =
    process.env.R2_ENDPOINT?.trim() ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw Object.assign(new Error('R2 is not configured for event registration uploads'), {
      code: 'r2_not_configured',
      status: 503,
    });
  }
  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

function extensionForMime(mime: string) {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  return 'jpg';
}

function normalizeMobile(raw: string) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 10) return digits;
  return '';
}

function safeToken(value: string, fallback: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return cleaned || fallback;
}

export type EventRegistrationUploadInput = {
  mobile: string;
  transactionId?: string;
  contentType: string;
  filename?: string;
  bytes: Buffer;
};

export type EventRegistrationUploadResult = {
  bucket: string;
  key: string;
  contentType: string;
  byteSize: number;
  screenshotUrl: string;
  storage: 'r2';
};

/**
 * Stores knock.org.in payment screenshots under
 * anticlock-private-documents/registration/… using server-side R2 credentials.
 */
export async function uploadEventRegistrationScreenshot(
  input: EventRegistrationUploadInput,
): Promise<EventRegistrationUploadResult> {
  const mobile = normalizeMobile(input.mobile);
  if (!mobile) {
    throw Object.assign(new Error('A valid 10-digit mobile number is required'), {
      code: 'validation_error',
      status: 400,
    });
  }

  const contentType = (input.contentType || '').toLowerCase().split(';')[0]!.trim();
  if (!ALLOWED_MIME.has(contentType)) {
    throw Object.assign(new Error('Only PNG, JPG, or WEBP screenshots are allowed'), {
      code: 'validation_error',
      status: 400,
    });
  }

  if (!input.bytes.length) {
    throw Object.assign(new Error('Screenshot file is empty'), {
      code: 'validation_error',
      status: 400,
    });
  }
  if (input.bytes.length > MAX_BYTES) {
    throw Object.assign(new Error('Screenshot must be 5 MB or smaller'), {
      code: 'file_too_large',
      status: 400,
    });
  }

  const ext = extensionForMime(contentType);
  const utr = safeToken(input.transactionId || '', String(Date.now()));
  const key = `registration/${mobile}/${utr}-${Date.now()}.${ext}`;
  const bucket = eventRegistrationBucket();
  const client = r2Client();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: input.bytes,
      ContentType: contentType,
      Metadata: {
        mobile,
        transactionid: utr,
        source: 'knock-org-in',
      },
    }),
  );

  const screenshotUrl = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 60 * 60 * 24 * 7 },
  );

  return {
    bucket,
    key,
    contentType,
    byteSize: input.bytes.length,
    screenshotUrl,
    storage: 'r2',
  };
}
