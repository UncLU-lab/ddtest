import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import {
  DataSource,
  EntityManager,
  EntityTarget,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { TenantContextService } from '../modules/cross-cutting/tenant-context/tenant-context.service';

@Injectable()
export class TenantDatabaseContextService {
  private readonly storage = new AsyncLocalStorage<EntityManager>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
  ) {}

  async runInTransaction<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const activeManager = this.storage.getStore();
    if (activeManager) {
      return work(activeManager);
    }

    const tenant = this.tenantContext.getContext();

    return this.dataSource.transaction(async (manager) => {
      await manager.query(
        `SELECT
           set_config('app.current_tenant_id', $1, true),
           set_config('app.current_user_id', $2, true)`,
        [tenant.organizationId, tenant.userId],
      );

      return this.storage.run(manager, () => work(manager));
    });
  }

  transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.runInTransaction(work);
  }

  getManager(): EntityManager {
    const manager = this.storage.getStore();

    if (!manager) {
      throw new UnauthorizedException(
        'Tenant-scoped database transaction is required',
      );
    }

    return manager;
  }

  createRepositoryProxy<Entity extends ObjectLiteral>(
    entity: EntityTarget<Entity>,
  ): Repository<Entity> {
    const baseRepository = this.dataSource.getRepository(entity);

    return new Proxy(baseRepository, {
      get: (target, property) => {
        if (property === 'manager') {
          return this.getManager();
        }

        if (property === 'queryRunner') {
          return this.getManager().queryRunner;
        }

        const baseValue = Reflect.get(target, property, target) as unknown;
        if (typeof baseValue !== 'function') {
          return baseValue;
        }

        return (...args: unknown[]) => {
          const repository = this.getManager().getRepository(entity);
          const method = Reflect.get(repository, property, repository) as (
            ...methodArgs: unknown[]
          ) => unknown;
          return method.apply(repository, args);
        };
      },
    });
  }
}
