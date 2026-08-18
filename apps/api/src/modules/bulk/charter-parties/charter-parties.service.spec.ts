import { ConflictException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { CharterParty } from '../entities/charter-party.entity';
import { CpClause } from '../entities/cp-clause.entity';
import { VoyagesService } from '../voyages/voyages.service';
import { CharterPartiesService } from './charter-parties.service';

function buildService(finalPeriod: unknown) {
  const clauses = {
    findOne: jest.fn().mockResolvedValue({ id: 'clause-1' }),
  };
  const manager = {
    createQueryBuilder: jest.fn(() => ({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(finalPeriod),
    })),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn((work) => work(manager)),
  };

  return {
    service: new CharterPartiesService(
      {} as Repository<CharterParty>,
      clauses as unknown as Repository<CpClause>,
      {} as VoyagesService,
      dataSource as unknown as DataSource,
    ),
    manager,
  };
}

describe('CharterPartiesService historical clause references', () => {
  it('rejects deleting a clause cited by a final calculation period', async () => {
    const { service, manager } = buildService({ id: 'final-period' });

    await expect(service.removeClause('clause-1')).rejects.toThrow(
      ConflictException,
    );
    expect(manager.update).not.toHaveBeenCalled();
    expect(manager.remove).not.toHaveBeenCalled();
  });

  it('continues to detach a clause from draft calculation periods before deletion', async () => {
    const { service, manager } = buildService(null);

    await expect(service.removeClause('clause-1')).resolves.toBeUndefined();
    expect(manager.update).toHaveBeenCalled();
    expect(manager.remove).toHaveBeenCalledWith({ id: 'clause-1' });
  });
});
