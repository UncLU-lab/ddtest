import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../cross-cutting/tenant-context/tenant-context.service';
import { Vessel } from '../entities/vessel.entity';
import { Voyage } from '../entities/voyage.entity';
import { VesselsService } from './vessels.service';

const ORGANIZATION_A = '00000000-0000-0000-0000-000000000001';
const ORGANIZATION_B = '00000000-0000-0000-0000-000000000002';
const VESSEL_ID = '11111111-1111-4111-8111-111111111111';

function buildService(organizationId = ORGANIZATION_A) {
  const queryBuilder = {
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
  const vessels = {
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    merge: jest.fn((target, source) => Object.assign(target, source)),
    remove: jest.fn(),
  };
  const voyages = {
    count: jest.fn().mockResolvedValue(0),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
  const tenantContext = {
    getOrganizationId: jest.fn().mockReturnValue(organizationId),
  };

  return {
    service: new VesselsService(
      vessels as unknown as Repository<Vessel>,
      voyages as unknown as Repository<Voyage>,
      tenantContext as unknown as TenantContextService,
    ),
    vessels,
    voyages,
    queryBuilder,
    tenantContext,
  };
}

describe('VesselsService tenant boundaries', () => {
  it('scopes list queries to the current organization', async () => {
    const { service, queryBuilder } = buildService();

    await service.findAll({ page: 1, limit: 20 } as any);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'vessel.organizationId = :organizationId',
      { organizationId: ORGANIZATION_A },
    );
  });

  it('persists the current organization on create', async () => {
    const { service, vessels } = buildService();

    await service.create({
      imo: '1234567',
      name: 'BW Magnolia',
      flag: 'Liberia',
      type: 'Bulk Carrier',
      dwt: 70000,
    });

    expect(vessels.save).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORGANIZATION_A,
      }),
    );
  });

  it('rejects vessels that belong to another organization', async () => {
    const { service, vessels } = buildService(ORGANIZATION_B);
    vessels.findOne.mockResolvedValueOnce(null);

    await expect(service.findOne(VESSEL_ID)).rejects.toThrow(
      NotFoundException,
    );
  });
});
