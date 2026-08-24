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

  it('accepts explicit Firebase production configuration', () => {
    expect(() =>
      validateAuthenticationEnvironment({
        NODE_ENV: 'production',
        DB_ENABLED: 'true',
        AUTH_MODE: 'firebase',
        FIREBASE_PROJECT_ID: 'demurrage-defender-production',
      }),
    ).not.toThrow();
  });
});
