import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import dotenv from 'dotenv';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { BulkModule } from './modules/bulk/bulk.module';
import { AuthenticationModule } from './modules/cross-cutting/auth/authentication.module';
import { TenantContextModule } from './modules/cross-cutting/tenant-context/tenant-context.module';

dotenv.config({
  path: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
  quiet: true,
});

// Feature modules need repositories, so they load only alongside the database.
const databaseImports =
  process.env.DB_ENABLED?.toLowerCase() === 'true'
    ? [DatabaseModule, AuthenticationModule, BulkModule]
    : [];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
    }),
    TenantContextModule,
    ...databaseImports,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
