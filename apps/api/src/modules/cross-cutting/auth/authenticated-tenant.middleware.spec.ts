import {
  Controller,
  Get,
  INestApplication,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import {
  AUTH_IDENTITY_VERIFIER,
  type AuthIdentityVerifier,
} from './auth-identity-verifier';
import { AuthenticatedTenantMiddleware } from './authenticated-tenant.middleware';
import { AuthenticatedUserResolverService } from './authenticated-user-resolver.service';

const ORGANIZATION_A = '00000000-0000-4000-8000-00000000000a';
const ORGANIZATION_B = '00000000-0000-4000-8000-00000000000b';
const USER_A = '00000000-0000-4000-8000-00000000001a';
const USER_B = '00000000-0000-4000-8000-00000000001b';

const verifyToken = jest.fn();
const resolveUser = jest.fn();

@Controller('api/v1/auth-probe')
class AuthProbeController {
  constructor(private readonly tenantContext: TenantContextService) {}

  @Get()
  getContext() {
    return this.tenantContext.getContext();
  }
}

@Module({
  controllers: [AuthProbeController],
  providers: [
    TenantContextService,
    AuthenticatedTenantMiddleware,
    {
      provide: AUTH_IDENTITY_VERIFIER,
      useValue: { verifyToken } satisfies AuthIdentityVerifier,
    },
    {
      provide: AuthenticatedUserResolverService,
      useValue: { resolve: resolveUser },
    },
  ],
})
class AuthProbeModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuthenticatedTenantMiddleware).forRoutes('*');
  }
}

function user(
  id: string,
  organizationId: string | null,
  organizationExists = organizationId !== null,
) {
  return {
    userId: id,
    organizationId,
    organizationExists,
  };
}

describe('AuthenticatedTenantMiddleware request boundary', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthProbeModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    verifyToken.mockReset();
    resolveUser.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a request without a bearer token', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth-probe').expect(401);

    expect(verifyToken).not.toHaveBeenCalled();
    expect(resolveUser).not.toHaveBeenCalled();
  });

  it('rejects an invalid bearer token', async () => {
    verifyToken.mockRejectedValue(new Error('invalid'));

    await request(app.getHttpServer())
      .get('/api/v1/auth-probe')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);

    expect(resolveUser).not.toHaveBeenCalled();
  });

  it('rejects a valid provider identity without a local user', async () => {
    verifyToken.mockResolvedValue({
      subject: 'unknown-firebase-user',
      provider: 'firebase',
    });
    resolveUser.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/api/v1/auth-probe')
      .set('Authorization', 'Bearer valid-token')
      .expect(403);
  });

  it('rejects a provisioned user without an organization', async () => {
    verifyToken.mockResolvedValue({
      subject: 'tenantless-user',
      provider: 'firebase',
    });
    resolveUser.mockResolvedValue(user(USER_A, null));

    await request(app.getHttpServer())
      .get('/api/v1/auth-probe')
      .set('Authorization', 'Bearer valid-token')
      .expect(403);
  });

  it('rejects a user whose organization relationship cannot be resolved', async () => {
    verifyToken.mockResolvedValue({
      subject: 'orphaned-user',
      provider: 'firebase',
    });
    resolveUser.mockResolvedValue(user(USER_A, ORGANIZATION_A, false));

    await request(app.getHttpServer())
      .get('/api/v1/auth-probe')
      .set('Authorization', 'Bearer valid-token')
      .expect(403);
  });

  it('derives Organization A from User A and ignores a forged tenant header', async () => {
    verifyToken.mockResolvedValue({
      subject: 'firebase-user-a',
      provider: 'firebase',
    });
    resolveUser.mockResolvedValue(user(USER_A, ORGANIZATION_A));

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth-probe')
      .set('Authorization', 'Bearer user-a-token')
      .set('x-organization-id', ORGANIZATION_B)
      .expect(200);

    expect(response.body).toEqual({
      organizationId: ORGANIZATION_A,
      userId: USER_A,
      providerIdentity: 'firebase-user-a',
      authenticationProvider: 'firebase',
    });
    expect(resolveUser).toHaveBeenCalledWith('firebase-user-a');
  });

  it('derives Organization B independently from User B', async () => {
    verifyToken.mockResolvedValue({
      subject: 'firebase-user-b',
      provider: 'firebase',
    });
    resolveUser.mockResolvedValue(user(USER_B, ORGANIZATION_B));

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth-probe')
      .set('Authorization', 'Bearer user-b-token')
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        organizationId: ORGANIZATION_B,
        userId: USER_B,
      }),
    );
  });
});
