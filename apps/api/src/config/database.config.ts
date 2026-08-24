import { registerAs } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';
import { databaseEntities } from '../database/entities';
import { validateProductionDatabaseEnvironment } from './env-validation';

export type AppDatabaseConfig = DataSourceOptions & {
  autoLoadEntities?: boolean;
};

export const DEFAULT_APPLICATION_DATABASE_ROLE = 'demurrage_defender_app';

export interface DatabaseConfigOptions {
  useApplicationRole?: boolean;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function readBoolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined) {
    return fallback;
  }

  return value.trim().toLowerCase() === 'true';
}

export function createDatabaseConfig(
  options: DatabaseConfigOptions = {},
): AppDatabaseConfig {
  validateProductionDatabaseEnvironment(process.env);

  const connection = isProduction()
    ? process.env.DATABASE_URL
      ? { url: process.env.DATABASE_URL }
      : {
          host: process.env.DB_HOST,
          port: Number.parseInt(process.env.DB_PORT ?? '', 10),
          username: process.env.DB_USERNAME,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_DATABASE,
        }
    : process.env.DATABASE_URL
      ? { url: process.env.DATABASE_URL }
      : {
          host: process.env.DB_HOST ?? 'localhost',
          port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
          username: process.env.DB_USERNAME ?? 'demurrage-defender-user',
          password: process.env.DB_PASSWORD ?? 'demurrage-defender-password',
          database: process.env.DB_DATABASE ?? 'demurrage-defender',
        };

  const applicationRole =
    process.env.DB_APPLICATION_ROLE?.trim() ||
    DEFAULT_APPLICATION_DATABASE_ROLE;

  if (!/^[a-z_][a-z0-9_]*$/.test(applicationRole)) {
    throw new Error(
      'Invalid database configuration: DB_APPLICATION_ROLE must be a PostgreSQL identifier.',
    );
  }

  return {
    type: 'postgres',
    ...connection,
    entities: [...databaseEntities],
    migrations: [__dirname + '/../migrations/!(*.spec|*.test|*.d).{ts,js}'],
    synchronize: false,
    dropSchema: false,
    logging: readBoolean(process.env.DB_LOGGING),
    ssl: readBoolean(process.env.DB_SSL)
      ? {
          rejectUnauthorized: readBoolean(
            process.env.DB_SSL_REJECT_UNAUTHORIZED,
            true,
          ),
        }
      : false,
    ...(options.useApplicationRole === false
      ? {}
      : {
          // Migrations connect as the privileged owner; runtime connections
          // always assume the non-owner role that is subject to RLS.
          extra: {
            options: `-c role=${applicationRole}`,
          },
        }),
  };
}

export default registerAs(
  'database',
  (): AppDatabaseConfig => createDatabaseConfig(),
);
