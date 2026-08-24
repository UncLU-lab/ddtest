import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validateAuthenticationEnvironment } from '../../../config/env-validation';
import {
  AUTH_IDENTITY_VERIFIER,
  type AuthIdentityVerifier,
} from './auth-identity-verifier';
import { DevelopmentIdentityVerifier } from './development-identity.verifier';
import { FirebaseIdentityVerifier } from './firebase-identity.verifier';

export type FirebaseAdminModules = {
  app: typeof import('firebase-admin/app');
  auth: typeof import('firebase-admin/auth');
};

type FirebaseAdminLoader = () => Promise<FirebaseAdminModules>;

async function loadFirebaseAdmin(): Promise<FirebaseAdminModules> {
  const [app, auth] = await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/auth'),
  ]);

  return { app, auth };
}

export async function createAuthIdentityVerifier(
  config: ConfigService,
  firebaseAdminLoader: FirebaseAdminLoader = loadFirebaseAdmin,
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
  const clientEmail = config.get<string>('FIREBASE_CLIENT_EMAIL');
  const privateKey = config.get<string>('FIREBASE_PRIVATE_KEY');
  const {
    app: { applicationDefault, cert, getApps, initializeApp },
    auth: { getAuth },
  } = await firebaseAdminLoader();
  const credential =
    clientEmail && privateKey
      ? cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        })
      : applicationDefault();
  const firebaseApp =
    getApps()[0] ??
    initializeApp({
      credential,
      projectId,
    });

  return new FirebaseIdentityVerifier(getAuth(firebaseApp));
}

export const authIdentityVerifierProvider: Provider = {
  provide: AUTH_IDENTITY_VERIFIER,
  inject: [ConfigService],
  useFactory: createAuthIdentityVerifier,
};
