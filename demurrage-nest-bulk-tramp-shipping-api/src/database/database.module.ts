import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import databaseConfig, { AppDatabaseConfig } from '../config/database.config';

@Global()
@Module({
  imports: [
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
})
export class DatabaseModule {}
