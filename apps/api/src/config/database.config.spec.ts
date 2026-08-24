import { createDatabaseConfig } from './database.config';

describe('database configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      DB_ENABLED: 'false',
    };
    delete process.env.DATABASE_URL;
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_USERNAME;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_DATABASE;
    delete process.env.DB_APPLICATION_ROLE;
    delete process.env.DB_LOGGING;
    delete process.env.DB_SSL;
    delete process.env.DB_SSL_REJECT_UNAUTHORIZED;
    delete process.env.DB_POOL_MAX;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('preserves development database defaults and uses a conservative runtime pool', () => {
    const config = createDatabaseConfig();

    expect(config).toEqual(
      expect.objectContaining({
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        username: 'demurrage-defender-user',
        password: 'demurrage-defender-password',
        database: 'demurrage-defender',
        synchronize: false,
        dropSchema: false,
        logging: false,
        ssl: false,
        extra: {
          options: '-c role=demurrage_defender_app',
          max: 2,
        },
      }),
    );
  });

  it('uses DATABASE_URL in preference to discrete connection fields', () => {
    process.env.DATABASE_URL =
      'postgresql://database-user:database-password@database.example.test:5432/database';
    process.env.DB_HOST = 'ignored.example.test';
    process.env.DB_POOL_MAX = '4';

    const config = createDatabaseConfig();

    expect(config).toEqual(
      expect.objectContaining({
        url: process.env.DATABASE_URL,
        extra: {
          options: '-c role=demurrage_defender_app',
          max: 4,
        },
      }),
    );
    expect(config).not.toHaveProperty('host');
  });

  it.each(['0', '-1', '1.5', 'not-a-number'])(
    'rejects invalid DB_POOL_MAX value %s',
    (poolMax) => {
      process.env.NODE_ENV = 'production';
      process.env.DB_ENABLED = 'true';
      process.env.DATABASE_URL =
        'postgresql://database-user:database-password@database.example.test:5432/database';
      process.env.DB_POOL_MAX = poolMax;

      expect(() => createDatabaseConfig()).toThrow(
        'DB_POOL_MAX must be a positive integer',
      );
    },
  );

  it('does not apply the serverless runtime pool or RLS role to migrations', () => {
    process.env.DB_POOL_MAX = '4';

    const config = createDatabaseConfig({ useApplicationRole: false });

    expect(config.extra).toBeUndefined();
    expect(config.synchronize).toBe(false);
  });
});
