import { TenantContextService } from './tenant-context.service';

describe('TenantContextService', () => {
  it('preserves authenticated identity through asynchronous work', async () => {
    const service = new TenantContextService();
    const context = {
      organizationId: '00000000-0000-4000-8000-00000000000a',
      userId: '00000000-0000-4000-8000-00000000001a',
      providerIdentity: 'firebase-user-a',
      authenticationProvider: 'firebase' as const,
    };

    await service.run(context, async () => {
      await Promise.resolve();

      expect(service.getContext()).toEqual(context);
      expect(service.getOrganizationId()).toBe(context.organizationId);
      expect(service.getUserId()).toBe(context.userId);
    });
  });

  it('does not provide a fallback tenant outside an authenticated request', () => {
    const service = new TenantContextService();

    expect(() => service.getOrganizationId()).toThrow(
      'Authenticated request context is required',
    );
  });
});
