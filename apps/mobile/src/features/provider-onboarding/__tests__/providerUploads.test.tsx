import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, Text } from 'react-native';

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));
jest.mock('@/shared/api/client', () => ({
  apiRequest: jest.fn(),
  getApiToken: () => null,
}));
jest.mock('@/shared/api/config', () => ({
  getApiBaseUrl: () => 'http://10.0.2.2:4100',
  isApiEnabled: true,
}));
jest.mock('@/shared/services/auth/authService', () => ({
  readStoredSession: () => ({ token: 't' }),
}));
jest.mock('@/shared/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: new Proxy({}, { get: () => '#000' }),
    mode: 'light',
  }),
}));
jest.mock('@/shared/components/AppIcon', () => ({ AppIcon: () => null }));
jest.mock('@/shared/components/PressableScale', () => {
  const { TouchableOpacity } = require('react-native');
  return {
    PressableScale: ({ children, onPress, accessibilityLabel }: any) => (
      <TouchableOpacity
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </TouchableOpacity>
    ),
  };
});

import {
  fileFromAsset,
  resolveUploadTarget,
  validatePickedFile,
} from '@/features/provider-onboarding/utils/providerUploads';
import {
  ProviderMediaField,
  UploadTile,
} from '@/features/provider-onboarding/components/ProviderMediaField';

function texts(r: ReactTestRenderer.ReactTestRenderer) {
  return r.root
    .findAllByType(Text)
    .map(n => [n.props.children].flat().join(''));
}

describe('provider upload validation', () => {
  it('checks MIME type and size per field type', () => {
    expect(
      validatePickedFile(
        { contentType: 'image/jpeg', byteSize: 1000 },
        'image',
      ),
    ).toBeNull();
    expect(
      validatePickedFile({ contentType: 'image/gif', byteSize: 1000 }, 'image'),
    ).toMatch(/Unsupported/);
    expect(
      validatePickedFile(
        { contentType: 'image/heic', byteSize: 1000 },
        'document',
      ),
    ).toMatch(/HEIC/);
    expect(
      validatePickedFile(
        { contentType: 'image/png', byteSize: 11 * 1024 * 1024 },
        'image',
      ),
    ).toMatch(/limit is 10.0 MB/);
    expect(
      validatePickedFile(
        { contentType: 'application/pdf', byteSize: 5 },
        'document',
      ),
    ).toBeNull();
    expect(
      validatePickedFile({ contentType: 'video/mp4', byteSize: 5 }, 'video'),
    ).toMatch(/duration/);
  });

  it('normalises picker assets', () => {
    expect(
      fileFromAsset(
        {
          uri: 'file:///a/IMG_1.PNG',
          fileName: 'IMG_1.PNG',
          fileSize: 42,
          duration: 2.5,
        },
        'image',
      ),
    ).toMatchObject({
      contentType: 'image/png',
      byteSize: 42,
      filename: 'IMG_1.PNG',
      durationMs: 2500,
    });
  });

  it('rebuilds local upload routes on the app API origin but leaves presigned URLs alone', () => {
    expect(
      resolveUploadTarget(
        'http://localhost:4100/v1/provider/applications/a1/kyc-upload-sessions/s1/content',
        'http://10.0.2.2:4100',
      ),
    ).toEqual({
      url: 'http://10.0.2.2:4100/v1/provider/applications/a1/kyc-upload-sessions/s1/content',
      needsAuth: true,
    });
    const r2 =
      'https://bucket.r2.cloudflarestorage.com/private/x?X-Amz-Signature=abc';
    expect(resolveUploadTarget(r2, 'http://10.0.2.2:4100')).toEqual({
      url: r2,
      needsAuth: false,
    });
  });
});

describe('UploadTile states', () => {
  it('shows progress, error with retry, and uploaded with replace/remove', () => {
    const onRetry = jest.fn();
    let r!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      r = ReactTestRenderer.create(
        <UploadTile
          kind="image"
          item={{
            id: '1',
            status: 'uploading',
            progress: 0.42,
            filename: 'a.jpg',
          }}
        />,
      );
    });
    expect(texts(r)).toContain('Uploading 42%');

    ReactTestRenderer.act(() => {
      r.update(
        <UploadTile
          kind="image"
          onRetry={onRetry}
          onRemove={jest.fn()}
          item={{
            id: '1',
            status: 'error',
            progress: 0,
            error: 'Upload timed out',
            file: {
              uri: 'file:///a.jpg',
              filename: 'a.jpg',
              contentType: 'image/jpeg',
            },
          }}
        />,
      );
    });
    expect(texts(r)).toContain('Upload timed out');
    ReactTestRenderer.act(() => {
      r.root
        .findByProps({ accessibilityLabel: 'Retry upload' })
        .props.onPress();
    });
    expect(onRetry).toHaveBeenCalled();

    ReactTestRenderer.act(() => {
      r.update(
        <UploadTile
          kind="document"
          onRemove={jest.fn()}
          onReplace={jest.fn()}
          item={{
            id: '1',
            status: 'uploaded',
            progress: 1,
            filename: 'ID document uploaded',
          }}
        />,
      );
    });
    expect(texts(r)).toContain('Uploaded');
    expect(
      r.root.findAllByProps({ accessibilityLabel: 'Replace file' }).length,
    ).toBeGreaterThan(0);
    expect(
      r.root.findAllByProps({ accessibilityLabel: 'Remove file' }).length,
    ).toBeGreaterThan(0);
  });
});

describe('ProviderMediaField', () => {
  const file = {
    uri: 'file:///logo.jpg',
    filename: 'logo.jpg',
    contentType: 'image/jpeg',
    byteSize: 2048,
  };

  beforeEach(() => {
    // Choose "library" from the source sheet.
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.[1]?.onPress?.();
    });
  });
  afterEach(() => jest.restoreAllMocks());

  async function flush() {
    await ReactTestRenderer.act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  }

  it('uploads, reports progress and stores the media id; failures can be retried', async () => {
    const onUploaded = jest.fn();
    let fail = true;
    const upload = jest.fn(async ({ onProgress }: any) => {
      onProgress(0.5);
      if (fail) throw new Error('Upload could not reach the server.');
      return { mediaId: 'media-1', url: 'https://cdn/logo.jpg' };
    });
    const pick = jest.fn(async () => [file]);
    let r!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      r = ReactTestRenderer.create(
        <ProviderMediaField
          applicationId="app-1"
          fieldKey="profile.logo"
          label="Logo"
          kind="image"
          purpose="profile"
          initialItems={[]}
          upload={upload as never}
          pick={pick as never}
          onUploaded={onUploaded}
          onRemoved={jest.fn()}
        />,
      );
    });
    ReactTestRenderer.act(() => {
      r.root.findByProps({ accessibilityLabel: 'Upload Logo' }).props.onPress();
    });
    await flush();
    expect(pick).toHaveBeenCalledWith('image', 'library', 1);
    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: 'app-1',
        fieldKey: 'profile.logo',
        purpose: 'profile',
        kind: 'image',
      }),
    );
    expect(texts(r)).toContain('Upload could not reach the server.');
    expect(onUploaded).not.toHaveBeenCalled();

    fail = false;
    ReactTestRenderer.act(() => {
      r.root
        .findByProps({ accessibilityLabel: 'Retry upload' })
        .props.onPress();
    });
    await flush();
    expect(onUploaded).toHaveBeenCalledWith('media-1', 'https://cdn/logo.jpg');
    expect(texts(r)).toContain('Uploaded');
  });

  it('rejects an oversized file before uploading', async () => {
    const upload = jest.fn();
    const pick = jest.fn(async () => [{ ...file, byteSize: 50 * 1024 * 1024 }]);
    let r!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      r = ReactTestRenderer.create(
        <ProviderMediaField
          applicationId="app-1"
          fieldKey="profile.logo"
          label="Logo"
          kind="image"
          purpose="profile"
          initialItems={[]}
          upload={upload as never}
          pick={pick as never}
          onUploaded={jest.fn()}
          onRemoved={jest.fn()}
        />,
      );
    });
    ReactTestRenderer.act(() => {
      r.root.findByProps({ accessibilityLabel: 'Upload Logo' }).props.onPress();
    });
    await flush();
    expect(upload).not.toHaveBeenCalled();
    expect(texts(r).some(t => t.includes('The limit is 10.0 MB'))).toBe(true);
  });

  it('removes an uploaded document through the callback', async () => {
    const onRemoved = jest.fn(async () => undefined);
    let r!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      r = ReactTestRenderer.create(
        <ProviderMediaField
          applicationId="app-1"
          fieldKey="identity.idDocument"
          label="ID document"
          kind="document"
          purpose="document"
          initialItems={[
            {
              id: 'd',
              status: 'uploaded',
              progress: 1,
              mediaId: 'doc-1',
              filename: 'ID',
            },
          ]}
          onUploaded={jest.fn()}
          onRemoved={onRemoved}
        />,
      );
    });
    ReactTestRenderer.act(() => {
      r.root.findByProps({ accessibilityLabel: 'Remove file' }).props.onPress();
    });
    await flush();
    expect(onRemoved).toHaveBeenCalledWith('doc-1');
    expect(texts(r)).toContain('Upload document');
  });
});
