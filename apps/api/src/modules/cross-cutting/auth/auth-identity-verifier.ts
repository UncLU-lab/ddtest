export const AUTH_IDENTITY_VERIFIER = Symbol('AUTH_IDENTITY_VERIFIER');

export interface AuthenticatedProviderIdentity {
  subject: string;
  provider: 'firebase' | 'development';
  email?: string;
}

export interface AuthIdentityVerifier {
  verifyToken(token: string): Promise<AuthenticatedProviderIdentity>;
}
