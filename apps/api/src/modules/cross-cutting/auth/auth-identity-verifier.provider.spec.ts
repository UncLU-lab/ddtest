import { ConfigService } from '@nestjs/config';
import {
  createAuthIdentityVerifier,
  type FirebaseAdminModules,
} from './auth-identity-verifier.provider';

const mockApplicationDefault = jest.fn();
const mockCert = jest.fn();
const mockGetApps = jest.fn();
const mockInitializeApp = jest.fn();
const mockGetAuth = jest.fn();
const mockFirebaseApp = { name: 'firebase-test-app' };
const mockFirebaseAuth = { verifyIdToken: jest.fn() };

const loadFirebaseAdmin = jest.fn(
  async (): Promise<FirebaseAdminModules> =>
    ({
      app: {
        applicationDefault: mockApplicationDefault,
        cert: mockCert,
        getApps: mockGetApps,
        initializeApp: mockInitializeApp,
      },
      auth: {
        getAuth: mockGetAuth,
      },
    }) as unknown as FirebaseAdminModules,
);

function configServiceFor(env: NodeJS.ProcessEnv): ConfigService {
  return {
    get: jest.fn((name: string) => env[name]),
    getOrThrow: jest.fn((name: string) => {
      const value = env[name];
      if (value === undefined) {
        throw new Error(`Missing ${name}`);
      }
      return value;
    }),
  } as unknown as ConfigService;
}

describe('Firebase authentication provider initialization', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockApplicationDefault.mockReturnValue({ source: 'adc' });
    mockCert.mockReturnValue({ source: 'explicit' });
    mockGetApps.mockReturnValue([]);
    mockInitializeApp.mockReturnValue(mockFirebaseApp);
    mockGetAuth.mockReturnValue(mockFirebaseAuth);
    loadFirebaseAdmin.mockClear();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      DB_ENABLED: 'true',
      AUTH_MODE: 'firebase',
      FIREBASE_PROJECT_ID: 'demurrage-defender-production',
    };
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses explicit service-account credentials and normalizes escaped newlines', async () => {
    process.env.FIREBASE_CLIENT_EMAIL = 'firebase-admin@example.test';
    process.env.FIREBASE_PRIVATE_KEY = 'line-one\\nline-two\\n';

    await createAuthIdentityVerifier(
      configServiceFor(process.env),
      loadFirebaseAdmin,
    );

    expect(mockCert).toHaveBeenCalledWith({
      projectId: 'demurrage-defender-production',
      clientEmail: 'firebase-admin@example.test',
      privateKey: 'line-one\nline-two\n',
    });
    expect(mockApplicationDefault).not.toHaveBeenCalled();
    expect(mockInitializeApp).toHaveBeenCalledWith({
      credential: { source: 'explicit' },
      projectId: 'demurrage-defender-production',
    });
    expect(mockGetAuth).toHaveBeenCalledWith(mockFirebaseApp);
  });

  it('falls back to Application Default Credentials', async () => {
    await createAuthIdentityVerifier(
      configServiceFor(process.env),
      loadFirebaseAdmin,
    );

    expect(mockApplicationDefault).toHaveBeenCalledTimes(1);
    expect(mockCert).not.toHaveBeenCalled();
    expect(mockInitializeApp).toHaveBeenCalledWith({
      credential: { source: 'adc' },
      projectId: 'demurrage-defender-production',
    });
  });

  it('does not log explicit Firebase credentials', async () => {
    process.env.FIREBASE_CLIENT_EMAIL = 'firebase-admin@example.test';
    process.env.FIREBASE_PRIVATE_KEY = 'placeholder-private-key';
    const log = jest.spyOn(console, 'log').mockImplementation();
    const warn = jest.spyOn(console, 'warn').mockImplementation();
    const error = jest.spyOn(console, 'error').mockImplementation();

    try {
      await createAuthIdentityVerifier(
        configServiceFor(process.env),
        loadFirebaseAdmin,
      );

      expect(log).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
      warn.mockRestore();
      error.mockRestore();
    }
  });
});
