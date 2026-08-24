import type { Auth } from 'firebase-admin/auth';
import type {
  AuthenticatedProviderIdentity,
  AuthIdentityVerifier,
} from './auth-identity-verifier';

export class FirebaseIdentityVerifier implements AuthIdentityVerifier {
  constructor(private readonly firebaseAuth: Auth) {}

  async verifyToken(token: string): Promise<AuthenticatedProviderIdentity> {
    const decoded = await this.firebaseAuth.verifyIdToken(token, true);

    return {
      subject: decoded.uid,
      provider: 'firebase',
      ...(decoded.email ? { email: decoded.email } : {}),
    };
  }
}
