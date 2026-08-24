import {
  ForbiddenException,
  Inject,
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import {
  AUTH_IDENTITY_VERIFIER,
  type AuthIdentityVerifier,
} from './auth-identity-verifier';
import { AuthenticatedUserResolverService } from './authenticated-user-resolver.service';

@Injectable()
export class AuthenticatedTenantMiddleware implements NestMiddleware {
  constructor(
    @Inject(AUTH_IDENTITY_VERIFIER)
    private readonly identityVerifier: AuthIdentityVerifier,
    private readonly users: AuthenticatedUserResolverService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async use(
    request: Request,
    _response: Response,
    next: NextFunction,
  ): Promise<void> {
    if (!request.originalUrl.startsWith('/api/v1')) {
      next();
      return;
    }

    const token = this.readBearerToken(request);
    let identity;

    try {
      identity = await this.identityVerifier.verifyToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired bearer token');
    }

    const user = await this.users.resolve(identity.subject);

    if (!user) {
      throw new ForbiddenException(
        'Authenticated user is not provisioned for Demurrage Defender',
      );
    }

    if (!user.organizationId || !user.organizationExists) {
      throw new ForbiddenException(
        'Authenticated user is not assigned to a valid organization',
      );
    }

    this.tenantContext.run(
      {
        organizationId: user.organizationId,
        userId: user.userId,
        providerIdentity: identity.subject,
        authenticationProvider: identity.provider,
      },
      () => next(),
    );
  }

  private readBearerToken(request: Request): string {
    const authorization = request.header('authorization')?.trim();
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1]?.trim();

    if (!token) {
      throw new UnauthorizedException('Bearer authentication is required');
    }

    return token;
  }
}
