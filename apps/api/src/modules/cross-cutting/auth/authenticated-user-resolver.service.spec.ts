import { DataSource } from 'typeorm';
import { AuthenticatedUserResolverService } from './authenticated-user-resolver.service';

describe('AuthenticatedUserResolverService', () => {
  it('uses the isolated database function and maps the resolved tenant identity', async () => {
    const dataSource = {
      query: jest.fn().mockResolvedValue([
        {
          user_id: 'user-1',
          organization_id: 'organization-1',
          organization_exists: true,
        },
      ]),
    };
    const service = new AuthenticatedUserResolverService(
      dataSource as unknown as DataSource,
    );

    await expect(service.resolve('firebase-user-1')).resolves.toEqual({
      userId: 'user-1',
      organizationId: 'organization-1',
      organizationExists: true,
    });
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('app.resolve_authenticated_user'),
      ['firebase-user-1'],
    );
  });

  it('returns null instead of provisioning an unknown authenticated identity', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([]) };
    const service = new AuthenticatedUserResolverService(
      dataSource as unknown as DataSource,
    );

    await expect(service.resolve('unknown-user')).resolves.toBeNull();
  });
});
