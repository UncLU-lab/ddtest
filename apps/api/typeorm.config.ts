import dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { createDatabaseConfig } from './src/config/database.config';

dotenv.config({
  path: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
  quiet: true,
});

// Schema migrations need the privileged owner connection. The Nest runtime
// uses the RLS-constrained application role from database.config.ts.
export default new DataSource(
  createDatabaseConfig({ useApplicationRole: false }),
);
