import type { AuthClaims } from '../lib/auth.js';
import type { MediaAccessLevel, Permission } from '@anticlock/contracts';

export class MediaAccessPolicy {
  canRead(auth: AuthClaims): boolean {
    return auth.permissions.includes('media.read');
  }

  canWrite(auth: AuthClaims): boolean {
    return auth.permissions.includes('media.write');
  }

  canDelete(auth: AuthClaims): boolean {
    return auth.permissions.includes('media.delete');
  }

  require(auth: AuthClaims, permission: Permission) {
    if (!auth.permissions.includes(permission)) {
      throw Object.assign(new Error('Insufficient permissions'), {
        code: 'forbidden',
        status: 403,
      });
    }
  }

  /** Private assets require auth; public ready assets may be served anonymously. */
  canDownloadAnonymous(accessLevel: MediaAccessLevel, processingStatus: string) {
    return accessLevel === 'public' && processingStatus === 'ready';
  }
}

export const mediaAccessPolicy = new MediaAccessPolicy();
