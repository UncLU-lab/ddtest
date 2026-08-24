import { validateAuthenticationEnvironment } from './env-validation';

describe('authentication environment validation', () => {
  it('requires an explicit authentication mode for a database-backed app', () => {
    expect(() =>
      validateAuthenticationEnvironment({ DB_ENABLED: 'true' }),
    ).toThrow('AUTH_MODE must be "firebase" or "development"');
  });

  it('rejects development authentication in production', () => {
    expect(() =>
      validateAuthenticationEnvironment({
        NODE_ENV: 'production',
        DB_ENABLED: 'true',
        AUTH_MODE: 'development',
        AUTH_DEVELOPMENT_TOKEN: 'token',
        AUTH_DEVELOPMENT_FIREBASE_UID: 'uid',
      }),
    ).toThrow('production requires AUTH_MODE="firebase"');
  });

  it('requires Firebase configuration in Firebase mode', () => {
    expect(() =>
      validateAuthenticationEnvironment({
        NODE_ENV: 'production',
        DB_ENABLED: 'true',
        AUTH_MODE: 'firebase',
      }),
    ).toThrow('FIREBASE_PROJECT_ID is required');
  });

  it('accepts Firebase production configuration backed by ADC', () => {
    expect(() =>
      validateAuthenticationEnvironment({
        NODE_ENV: 'production',
        DB_ENABLED: 'true',
        AUTH_MODE: 'firebase',
        FIREBASE_PROJECT_ID: 'demurrage-defender-production',
      }),
    ).not.toThrow();
  });

  it('accepts a complete explicit Firebase service-account configuration', () => {
    expect(() =>
      validateAuthenticationEnvironment({
        NODE_ENV: 'production',
        DB_ENABLED: 'true',
        AUTH_MODE: 'firebase',
        FIREBASE_PROJECT_ID: 'demurrage-defender-production',
        FIREBASE_CLIENT_EMAIL: 'firebase-admin@example.test',
        FIREBASE_PRIVATE_KEY: 'placeholder-private-key',
      }),
    ).not.toThrow();
  });

  it('rejects a Firebase client email without a private key', () => {
    expect(() =>
      validateAuthenticationEnvironment({
        NODE_ENV: 'production',
        DB_ENABLED: 'true',
        AUTH_MODE: 'firebase',
        FIREBASE_PROJECT_ID: 'demurrage-defender-production',
        FIREBASE_CLIENT_EMAIL: 'firebase-admin@example.test',
      }),
    ).toThrow(
      'FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY must be provided together',
    );
  });

  it('rejects a Firebase private key without a client email', () => {
    expect(() =>
      validateAuthenticationEnvironment({
        NODE_ENV: 'production',
        DB_ENABLED: 'true',
        AUTH_MODE: 'firebase',
        FIREBASE_PROJECT_ID: 'demurrage-defender-production',
        FIREBASE_PRIVATE_KEY: 'placeholder-private-key',
      }),
    ).toThrow(
      'FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY must be provided together',
    );
  });
});
