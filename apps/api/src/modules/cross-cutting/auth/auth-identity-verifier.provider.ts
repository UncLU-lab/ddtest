import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validateAuthenticationEnvironment } from '../../../config/env-validation';
import {
  AUTH_IDENTITY_VERIFIER,
  type AuthIdentityVerifier,
} from './auth-identity-verifier';
import { DevelopmentIdentityVerifier } from './development-identity.verifier';
import { FirebaseIdentityVerifier } from './firebase-identity.verifier';

export async function createAuthIdentityVerifier(
  config: ConfigService,
): Promise<AuthIdentityVerifier> {
  validateAuthenticationEnvironment(process.env);

  const mode = config.get<string>('AUTH_MODE')?.trim().toLowerCase();

  if (mode === 'development') {
    return new DevelopmentIdentityVerifier(
      config.getOrThrow<string>('AUTH_DEVELOPMENT_TOKEN'),
      config.getOrThrow<string>('AUTH_DEVELOPMENT_FIREBASE_UID'),
    );
  }

  if (mode !== 'firebase') {
    throw new Error('Unsupported authentication mode');
  }

  const projectId = config.getOrThrow<string>('FIREBASE_PROJECT_ID');
  const [{ applicationDefault, getApps, initializeApp }, { getAuth }] =
    await Promise.all([
      import('firebase-admin/app'),
      import('firebase-admin/auth'),
    ]);
  const firebaseApp =
    getApps()[0] ??
    initializeApp({
      credential: applicationDefault(),
      projectId,
    });

  return new FirebaseIdentityVerifier(getAuth(firebaseApp));
}

export const authIdentityVerifierProvider: Provider = {
  provide: AUTH_IDENTITY_VERIFIER,
  inject: [ConfigService],
  useFactory: createAuthIdentityVerifier,
};
