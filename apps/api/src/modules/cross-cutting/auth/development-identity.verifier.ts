import { timingSafeEqual } from 'node:crypto';
import type {
  AuthenticatedProviderIdentity,
  AuthIdentityVerifier,
} from './auth-identity-verifier';

export class DevelopmentIdentityVerifier implements AuthIdentityVerifier {
  constructor(
    private readonly expectedToken: string,
    private readonly firebaseUid: string,
  ) {}

  verifyToken(token: string): Promise<AuthenticatedProviderIdentity> {
    const actual = Buffer.from(token);
    const expected = Buffer.from(this.expectedToken);

    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      return Promise.reject(new Error('Invalid development bearer token'));
    }

    return Promise.resolve({
      subject: this.firebaseUid,
      provider: 'development',
    });
  }
}
