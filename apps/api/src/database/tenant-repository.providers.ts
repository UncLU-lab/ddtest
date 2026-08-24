import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityTarget, ObjectLiteral } from 'typeorm';
import { TenantDatabaseContextService } from './tenant-database-context.service';

export function createTenantRepositoryProviders(entities: readonly Function[]) {
  return entities.map((entity) => ({
    provide: getRepositoryToken(entity),
    inject: [TenantDatabaseContextService],
    useFactory: (databaseContext: TenantDatabaseContextService) =>
      databaseContext.createRepositoryProxy(
        entity as EntityTarget<ObjectLiteral>,
      ),
  }));
}
