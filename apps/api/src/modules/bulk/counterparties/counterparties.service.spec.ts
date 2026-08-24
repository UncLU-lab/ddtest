import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../cross-cutting/tenant-context/tenant-context.service';
import { Counterparty } from '../entities/counterparty.entity';
import { CounterpartiesService } from './counterparties.service';

const ORGANIZATION_A = '00000000-0000-0000-0000-000000000001';
const ORGANIZATION_B = '00000000-0000-0000-0000-000000000002';
const COUNTERPARTY_ID = '11111111-1111-4111-8111-111111111111';

function buildService(organizationId = ORGANIZATION_A) {
  const queryBuilder = {
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
  const counterparties = {
    findOne: jest.fn(),
    save: jest.fn(async (value) => value),
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    create: jest.fn((value) => value),
    merge: jest.fn((target, source) => Object.assign(target, source)),
  };
  const tenantContext = {
    getOrganizationId: jest.fn().mockReturnValue(organizationId),
  };

  return {
    service: new CounterpartiesService(
      counterparties as unknown as Repository<Counterparty>,
      tenantContext as unknown as TenantContextService,
    ),
    counterparties,
    queryBuilder,
  };
}

describe('CounterpartiesService tenant boundaries', () => {
  it('scopes list queries to the current organization', async () => {
    const { service, queryBuilder } = buildService();

    await service.findAll({ page: 1, limit: 20 } as any);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'counterparty.organizationId = :organizationId',
      { organizationId: ORGANIZATION_A },
    );
  });

  it('persists the current organization on create', async () => {
    const { service, counterparties } = buildService();

    await service.create({
      name: 'Vitol Asia',
      type: 'charterer',
    });

    expect(counterparties.save).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORGANIZATION_A,
      }),
    );
  });

  it('rejects counterparties that belong to another organization', async () => {
    const { service, counterparties } = buildService(ORGANIZATION_B);
    counterparties.findOne.mockResolvedValueOnce(null);

    await expect(service.findOne(COUNTERPARTY_ID)).rejects.toThrow(
      NotFoundException,
    );
  });
});
