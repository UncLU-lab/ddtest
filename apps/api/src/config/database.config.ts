import { registerAs } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';
import { databaseEntities } from '../database/entities';
import { validateProductionDatabaseEnvironment } from './env-validation';

export type AppDatabaseConfig = DataSourceOptions & {
  autoLoadEntities?: boolean;
};

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function readBoolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined) {
    return fallback;
  }

  return value.trim().toLowerCase() === 'true';
}

export default registerAs('database', (): AppDatabaseConfig => {
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

  return {
    type: 'postgres',
    ...connection,
    entities: [...databaseEntities],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
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
  };
});
