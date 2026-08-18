import dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import databaseConfig from './src/config/database.config';

dotenv.config({
  path: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
  quiet: true,
});

export default new DataSource(databaseConfig());
