import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TenantContextModule } from '../tenant-context/tenant-context.module';
import { authIdentityVerifierProvider } from './auth-identity-verifier.provider';
import { AuthenticatedUserResolverService } from './authenticated-user-resolver.service';
import { AuthenticatedTenantMiddleware } from './authenticated-tenant.middleware';

@Module({
  imports: [ConfigModule, TenantContextModule],
  providers: [
    authIdentityVerifierProvider,
    AuthenticatedUserResolverService,
    AuthenticatedTenantMiddleware,
  ],
})
export class AuthenticationModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuthenticatedTenantMiddleware).forRoutes('*');
  }
}
