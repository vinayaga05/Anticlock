import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  uploadEventRegistrationScreenshot,
  type EventRegistrationUploadInput,
} from './EventRegistrationUploadService.js';

describe('event registration screenshot uploads', () => {
  const originalEnv = { ...process.env };
  const validInput: EventRegistrationUploadInput = {
    mobile: '+91 90000 00000',
    transactionId: 'UTR/../../123',
    contentType: 'image/png',
    bytes: Buffer.from('test image bytes'),
  };

  beforeEach(() => {
    process.env.R2_ENDPOINT = 'https://r2.example.test';
    process.env.R2_ACCESS_KEY_ID = 'test-access-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key';
    delete process.env.R2_BUCKET_EVENT_REGISTRATION;
    // Every S3 send is intercepted, including in validation tests.
    mock.method(S3Client.prototype, 'send', async () => ({}));
  });

  afterEach(() => {
    mock.restoreAll();
    process.env = { ...originalEnv };
  });

  it('stores images in the registration folder and returns a signed read URL', async () => {
    const send = mock.method(S3Client.prototype, 'send', async () => ({}));
    const result = await uploadEventRegistrationScreenshot(validInput);

    assert.equal(send.mock.callCount(), 1);
    const command = send.mock.calls[0]!.arguments[0] as PutObjectCommand;
    assert.ok(command instanceof PutObjectCommand);
    assert.equal(command.input.Bucket, 'anticlock-private-documents');
    assert.match(command.input.Key!, /^registration\/9000000000\/UTR123-\d+\.png$/);
    assert.equal(command.input.Body, validInput.bytes);
    assert.equal(command.input.ContentType, 'image/png');
    assert.deepEqual(command.input.Metadata, {
      mobile: '9000000000',
      transactionid: 'UTR123',
      source: 'knock-org-in',
    });
    assert.equal(result.storage, 'r2');
    assert.equal(result.key, command.input.Key);
    assert.equal(result.bucket, command.input.Bucket);
    assert.equal(result.byteSize, validInput.bytes.length);
    const url = new URL(result.screenshotUrl);
    assert.equal(url.hostname, 'anticlock-private-documents.r2.example.test');
    assert.equal(url.pathname, `/${result.key}`);
    assert.equal(url.searchParams.get('X-Amz-Expires'), '604800');
    assert.ok(url.searchParams.has('X-Amz-Signature'));
  });

  it('honors the event bucket and normalizes supported image MIME parameters', async () => {
    process.env.R2_BUCKET_EVENT_REGISTRATION = ' custom-event-bucket ';
    const result = await uploadEventRegistrationScreenshot({
      ...validInput,
      mobile: '9000000000',
      contentType: ' IMAGE/WEBP; charset=binary ',
    });
    assert.equal(result.bucket, 'custom-event-bucket');
    assert.equal(result.contentType, 'image/webp');
    assert.ok(result.key.endsWith('.webp'));
  });

  it('rejects invalid mobile numbers before contacting R2', async () => {
    await assert.rejects(
      uploadEventRegistrationScreenshot({ ...validInput, mobile: '12345' }),
      { status: 400, code: 'validation_error', message: /valid 10-digit mobile/ },
    );
  });

  it('rejects non-image MIME types before contacting R2', async () => {
    await assert.rejects(
      uploadEventRegistrationScreenshot({ ...validInput, contentType: 'application/pdf' }),
      { status: 400, code: 'validation_error', message: /Only PNG, JPG, or WEBP/ },
    );
  });

  it('rejects empty screenshots before contacting R2', async () => {
    await assert.rejects(
      uploadEventRegistrationScreenshot({ ...validInput, bytes: Buffer.alloc(0) }),
      { status: 400, code: 'validation_error', message: /file is empty/ },
    );
  });

  it('rejects screenshots over the 5 MB limit before contacting R2', async () => {
    await assert.rejects(
      uploadEventRegistrationScreenshot({
        ...validInput,
        bytes: Buffer.alloc(5 * 1024 * 1024 + 1),
      }),
      { status: 400, code: 'file_too_large' },
    );
  });

  it('accepts a screenshot exactly at the 5 MB limit', async () => {
    const result = await uploadEventRegistrationScreenshot({
      ...validInput,
      bytes: Buffer.alloc(5 * 1024 * 1024),
    });
    assert.equal(result.byteSize, 5 * 1024 * 1024);
  });

  it('returns a configuration error when R2 credentials are missing', async () => {
    delete process.env.R2_SECRET_ACCESS_KEY;
    await assert.rejects(uploadEventRegistrationScreenshot(validInput), {
      status: 503,
      code: 'r2_not_configured',
    });
  });
});
