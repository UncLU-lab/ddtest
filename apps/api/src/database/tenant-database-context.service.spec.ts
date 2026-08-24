import { UnauthorizedException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Voyage } from '../modules/bulk/entities/voyage.entity';
import { TenantContextService } from '../modules/cross-cutting/tenant-context/tenant-context.service';
import { TenantDatabaseContextService } from './tenant-database-context.service';

describe('TenantDatabaseContextService', () => {
  function buildService() {
    const repository = {
      findOne: jest.fn().mockResolvedValue({ id: 'voyage-1' }),
    };
    const manager = {
      query: jest.fn().mockResolvedValue([]),
      getRepository: jest.fn().mockReturnValue(repository),
      queryRunner: { id: 'request-query-runner' },
    };
    const dataSource = {
      transaction: jest.fn((work) => work(manager)),
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn(),
        metadata: { tableName: 'voyages' },
      }),
    };
    const tenantContext = {
      getContext: jest.fn().mockReturnValue({
        organizationId: '00000000-0000-4000-8000-000000000001',
        userId: '00000000-0000-4000-8000-000000000011',
      }),
    };
    const service = new TenantDatabaseContextService(
      dataSource as unknown as DataSource,
      tenantContext as unknown as TenantContextService,
    );

    return { service, dataSource, manager, repository, tenantContext };
  }

  it('sets transaction-local tenant and user context before database work', async () => {
    const { service, dataSource, manager } = buildService();

    await expect(
      service.runInTransaction(async (activeManager) => {
        expect(activeManager).toBe(manager);
        expect(service.getManager()).toBe(manager);
        return 'result';
      }),
    ).resolves.toBe('result');

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining("set_config('app.current_tenant_id'"),
      [
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000011',
      ],
    );
  });

  it('reuses the active request manager instead of opening a second transaction', async () => {
    const { service, dataSource, manager } = buildService();

    await service.runInTransaction(async () => {
      await service.transaction(async (nestedManager) => {
        expect(nestedManager).toBe(manager);
        return undefined;
      });
    });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('routes repository methods through the active transaction manager', async () => {
    const { service, repository } = buildService();
    const proxy = service.createRepositoryProxy(Voyage);

    await service.runInTransaction(async () => {
      await expect(
        proxy.findOne({ where: { id: 'voyage-1' } }),
      ).resolves.toEqual({ id: 'voyage-1' });
    });

    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: 'voyage-1' },
    });
  });

  it('fails closed when a tenant-aware repository is used without a request transaction', async () => {
    const { service } = buildService();
    const proxy = service.createRepositoryProxy(Voyage) as Repository<Voyage>;

    expect(() => proxy.findOne({ where: { id: 'voyage-1' } })).toThrow(
      UnauthorizedException,
    );
  });
});
