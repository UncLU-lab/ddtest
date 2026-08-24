import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  getProductionCorsOrigins,
  validateAuthenticationEnvironment,
  validateProductionEnvironment,
} from './config/env-validation';

async function bootstrap(): Promise<void> {
  validateProductionEnvironment(process.env);
  validateAuthenticationEnvironment(process.env);

  const app = await NestFactory.create(AppModule);

  const isProduction = process.env.NODE_ENV === 'production';

  app.enableCors(
    isProduction
      ? {
          origin: getProductionCorsOrigins(process.env),
          credentials: true,
        }
      : {
          origin: true,
          credentials: true,
        },
  );

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
