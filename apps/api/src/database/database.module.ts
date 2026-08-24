import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import databaseConfig, { AppDatabaseConfig } from '../config/database.config';
import { TenantContextModule } from '../modules/cross-cutting/tenant-context/tenant-context.module';
import { TenantDatabaseContextService } from './tenant-database-context.service';
import { TenantDatabaseInterceptor } from './tenant-database.interceptor';

@Global()
@Module({
  imports: [
    TenantContextModule,
    ConfigModule.forFeature(databaseConfig),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        const config = configService.get<AppDatabaseConfig>('database');

        if (!config) {
          throw new Error('Database configuration is missing');
        }

        return config;
      },
    }),
  ],
  providers: [
    TenantDatabaseContextService,
    TenantDatabaseInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useExisting: TenantDatabaseInterceptor,
    },
  ],
  exports: [TenantDatabaseContextService],
})
export class DatabaseModule {}
