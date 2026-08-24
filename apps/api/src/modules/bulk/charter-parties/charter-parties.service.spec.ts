import { BadRequestException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantDatabaseContextService } from '../../../database/tenant-database-context.service';
import { CharterParty } from '../entities/charter-party.entity';
import { CpClause } from '../entities/cp-clause.entity';
import { TenantContextService } from '../../cross-cutting/tenant-context/tenant-context.service';
import { VoyagesService } from '../voyages/voyages.service';
import { CharterPartiesService } from './charter-parties.service';

function buildService(finalPeriod: unknown) {
  const charterParties = {
    findOne: jest.fn().mockResolvedValue({
      id: 'charter-party-1',
      voyageId: 'voyage-1',
      clauses: [],
    }),
    merge: jest.fn((target, value) => Object.assign(target, value)),
    save: jest.fn(async (value) => value),
  };
  const clauses = {
    findOne: jest.fn().mockResolvedValue({
      id: 'clause-1',
      charterPartyId: 'charter-party-1',
      clauseType: 'laytime_rate',
      rawText: 'Laytime allowed: 48h',
      parameters: { hours: 48 },
      charterParty: { id: 'charter-party-1', voyageId: 'voyage-1' },
    }),
    create: jest.fn((value) => value),
    merge: jest.fn((target, value) => Object.assign(target, value)),
    save: jest.fn((value) => Promise.resolve(value)),
  };
  const voyagesService = {
    ensureExists: jest.fn().mockResolvedValue(undefined),
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
  const tenantContext = {
    getOrganizationId: jest
      .fn()
      .mockReturnValue('00000000-0000-0000-0000-000000000001'),
  };

  return {
    service: new CharterPartiesService(
      charterParties as unknown as Repository<CharterParty>,
      clauses as unknown as Repository<CpClause>,
      voyagesService as unknown as VoyagesService,
      dataSource as unknown as TenantDatabaseContextService,
      tenantContext as unknown as TenantContextService,
    ),
    charterParties,
    clauses,
    voyagesService,
    manager,
    tenantContext,
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
    expect(manager.remove).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'clause-1' }),
    );
  });

  it('rejects a charter party that belongs to another organization', async () => {
    const { service, charterParties, voyagesService } = buildService(null);
    charterParties.findOne.mockResolvedValueOnce({
      id: 'cp-1',
      voyageId: 'foreign-voyage',
      clauses: [],
    });
    voyagesService.ensureExists.mockRejectedValueOnce(
      new Error('Voyage not found'),
    );

    await expect(service.findOne('cp-1')).rejects.toThrow('Voyage not found');
  });
});

describe('CharterPartiesService settlement currency', () => {
  it('persists an explicit currency edit without mutating calculation history', async () => {
    const { service, charterParties } = buildService(null);

    await expect(
      service.update('charter-party-1', { settlementCurrency: 'EUR' }),
    ).resolves.toMatchObject({ settlementCurrency: 'EUR' });
    expect(charterParties.save).toHaveBeenCalledWith(
      expect.objectContaining({ settlementCurrency: 'EUR' }),
    );
  });
});

describe('CharterPartiesService reversible settlement contract', () => {
  it('rejects a second active reversible settlement clause', async () => {
    const { service, charterParties, clauses } = buildService(null);
    charterParties.findOne.mockResolvedValue({
      id: 'charter-party-1',
      voyageId: 'voyage-1',
      clauses: [
        {
          id: 'existing-reversible',
          clauseType: 'reversible_laytime',
          parameters: {
            enabled: true,
            settlementVersion: 1,
            allowanceMode: 'sum_operation_allowances',
          },
        },
      ],
    });

    await expect(
      service.addClause('charter-party-1', {
        clauseType: 'reversible_laytime',
        rawText: 'Reversible laytime V1',
        parameters: {
          enabled: true,
          settlementVersion: 1,
          allowanceMode: 'sum_operation_allowances',
        },
      }),
    ).rejects.toThrow('multiple active reversible laytime');
    expect(clauses.save).not.toHaveBeenCalled();
  });

  it('rejects a parameters-only PATCH that leaves an enabled legacy contract implicit', async () => {
    const { service, clauses } = buildService(null);
    clauses.findOne.mockResolvedValueOnce({
      id: 'legacy-reversible',
      charterPartyId: 'charter-party-1',
      clauseType: 'reversible_laytime',
      rawText: 'Historical reversible term',
      parameters: { enabled: true },
      charterParty: { id: 'charter-party-1', voyageId: 'voyage-1' },
    });

    await expect(
      service.updateClause('legacy-reversible', {
        parameters: { enabled: true },
      }),
    ).rejects.toThrow(BadRequestException);
    expect(clauses.save).not.toHaveBeenCalled();
  });

  it('upgrades an edited enabled legacy clause to the explicit V1 contract', async () => {
    const { service, charterParties, clauses } = buildService(null);
    const existing = {
      id: 'legacy-reversible',
      charterPartyId: 'charter-party-1',
      clauseType: 'reversible_laytime',
      rawText: 'Historical reversible term',
      parameters: { enabled: true },
      charterParty: { id: 'charter-party-1', voyageId: 'voyage-1' },
    };
    const parameters = {
      enabled: true,
      settlementVersion: 1,
      allowanceMode: 'sum_operation_allowances',
    };
    clauses.findOne.mockResolvedValueOnce(existing);
    charterParties.findOne.mockResolvedValueOnce({
      id: 'charter-party-1',
      voyageId: 'voyage-1',
      clauses: [existing],
    });

    await expect(
      service.updateClause('legacy-reversible', { parameters }),
    ).resolves.toEqual(expect.objectContaining({ parameters }));
  });
});

describe('CharterPartiesService NOR commencement clause contract', () => {
  const scheduleParameters = {
    cutoffReference: 'tenderTime',
    tenderCutoffTime: '12:00',
    sameDayCommencementTime: '13:00',
    nextWorkingDayCommencementTime: '08:00',
    workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    timeZone: 'Europe/London',
  };

  it('rejects adding a schedule when an explicit notice clause exists', async () => {
    const { service, charterParties, clauses } = buildService(null);
    charterParties.findOne.mockResolvedValueOnce({
      id: 'charter-party-1',
      voyageId: 'voyage-1',
      clauses: [
        {
          id: 'notice-clause',
          clauseType: 'laytime_rate',
          parameters: { hours: 48, noticeHours: 6 },
        },
      ],
    });

    await expect(
      service.addClause('charter-party-1', {
        clauseType: 'nor_commencement_schedule',
        rawText: 'NOR office schedule',
        parameters: scheduleParameters,
      }),
    ).rejects.toThrow(ConflictException);
    expect(clauses.save).not.toHaveBeenCalled();
  });

  it('rejects adding a schedule when the Charter Party has a global notice period', async () => {
    const { service, charterParties, clauses } = buildService(null);
    charterParties.findOne.mockResolvedValueOnce({
      id: 'charter-party-1',
      voyageId: 'voyage-1',
      norNoticePeriod: '6 hours',
      clauses: [],
    });

    await expect(
      service.addClause('charter-party-1', {
        clauseType: 'nor_commencement_schedule',
        rawText: 'NOR office schedule',
        parameters: scheduleParameters,
      }),
    ).rejects.toThrow(ConflictException);
    expect(clauses.save).not.toHaveBeenCalled();
  });

  it.each(['noticeHours', 'notice_hours', 'turnTimeHours'] as const)(
    'rejects adding explicit %s when a schedule exists',
    async (noticeKey) => {
      const { service, charterParties, clauses } = buildService(null);
      charterParties.findOne.mockResolvedValueOnce({
        id: 'charter-party-1',
        voyageId: 'voyage-1',
        clauses: [
          {
            id: 'schedule-clause',
            clauseType: 'nor_commencement_schedule',
            parameters: scheduleParameters,
          },
        ],
      });

      await expect(
        service.addClause('charter-party-1', {
          clauseType: 'laytime_rate',
          rawText: 'Laytime with notice',
          parameters: { hours: 48, [noticeKey]: 6 },
        }),
      ).rejects.toThrow(ConflictException);
      expect(clauses.save).not.toHaveBeenCalled();
    },
  );

  it('validates a parameters-only schedule PATCH using the persisted clause type', async () => {
    const { service, clauses } = buildService(null);
    clauses.findOne.mockResolvedValueOnce({
      id: 'schedule-clause',
      charterPartyId: 'charter-party-1',
      clauseType: 'nor_commencement_schedule',
      rawText: 'NOR office schedule',
      parameters: scheduleParameters,
      charterParty: { id: 'charter-party-1', voyageId: 'voyage-1' },
    });

    await expect(
      service.updateClause('schedule-clause', {
        parameters: { ...scheduleParameters, workingDays: [] },
      }),
    ).rejects.toThrow(BadRequestException);
    expect(clauses.save).not.toHaveBeenCalled();
  });

  it('accepts a valid parameters-only schedule PATCH after complete validation', async () => {
    const { service, charterParties, clauses } = buildService(null);
    const existing = {
      id: 'schedule-clause',
      charterPartyId: 'charter-party-1',
      clauseType: 'nor_commencement_schedule',
      rawText: 'NOR office schedule',
      parameters: scheduleParameters,
      charterParty: { id: 'charter-party-1', voyageId: 'voyage-1' },
    };
    clauses.findOne.mockResolvedValueOnce(existing);
    charterParties.findOne.mockResolvedValueOnce({
      id: 'charter-party-1',
      voyageId: 'voyage-1',
      clauses: [existing],
    });
    const updatedParameters = {
      ...scheduleParameters,
      cutoffReference: 'acceptedTime',
    };

    await expect(
      service.updateClause('schedule-clause', {
        parameters: updatedParameters,
      }),
    ).resolves.toEqual(
      expect.objectContaining({ parameters: updatedParameters }),
    );
    expect(clauses.save).toHaveBeenCalledTimes(1);
  });

  it('requires an edited legacy schedule to declare its cutoff reference', async () => {
    const { service, clauses } = buildService(null);
    const legacyParameters: Record<string, unknown> = {
      ...scheduleParameters,
    };
    delete legacyParameters.cutoffReference;
    clauses.findOne.mockResolvedValueOnce({
      id: 'legacy-schedule',
      charterPartyId: 'charter-party-1',
      clauseType: 'nor_commencement_schedule',
      rawText: 'Legacy NOR office schedule',
      parameters: legacyParameters,
      charterParty: { id: 'charter-party-1', voyageId: 'voyage-1' },
    });

    await expect(
      service.updateClause('legacy-schedule', {
        rawText: 'Edited legacy NOR office schedule',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(clauses.save).not.toHaveBeenCalled();
  });

  it('rejects an update that creates a schedule/notice conflict', async () => {
    const { service, charterParties, clauses } = buildService(null);
    const existing = {
      id: 'notice-clause',
      charterPartyId: 'charter-party-1',
      clauseType: 'laytime_rate',
      rawText: 'Laytime allowed: 48h',
      parameters: { hours: 48 },
      charterParty: { id: 'charter-party-1', voyageId: 'voyage-1' },
    };
    clauses.findOne.mockResolvedValueOnce(existing);
    charterParties.findOne.mockResolvedValueOnce({
      id: 'charter-party-1',
      voyageId: 'voyage-1',
      clauses: [
        existing,
        {
          id: 'schedule-clause',
          clauseType: 'nor_commencement_schedule',
          parameters: scheduleParameters,
        },
      ],
    });

    await expect(
      service.updateClause('notice-clause', {
        parameters: { hours: 48, noticeHours: 6 },
      }),
    ).rejects.toThrow(ConflictException);
    expect(clauses.save).not.toHaveBeenCalled();
  });

  it('rejects adding a new legacy SHEX clause', async () => {
    const { service, clauses } = buildService(null);

    await expect(
      service.addClause('charter-party-1', {
        clauseType: 'shex_shinc',
        rawText: 'Incomplete SHEX',
        parameters: { shex: true },
      }),
    ).rejects.toThrow(BadRequestException);
    expect(clauses.save).not.toHaveBeenCalled();
  });

  it('requires an edited legacy SHEX clause to upgrade to version 1', async () => {
    const { service, clauses } = buildService(null);
    clauses.findOne.mockResolvedValueOnce({
      id: 'legacy-shex',
      charterPartyId: 'charter-party-1',
      clauseType: 'shex_shinc',
      rawText: 'Legacy SHEX',
      parameters: { shex: true },
      charterParty: { id: 'charter-party-1', voyageId: 'voyage-1' },
    });

    await expect(
      service.updateClause('legacy-shex', { rawText: 'Edited legacy SHEX' }),
    ).rejects.toThrow(BadRequestException);
    expect(clauses.save).not.toHaveBeenCalled();
  });

  it('validates and persists a parameters-only legacy SHEX upgrade', async () => {
    const { service, charterParties, clauses } = buildService(null);
    const existing = {
      id: 'legacy-shex',
      charterPartyId: 'charter-party-1',
      clauseType: 'shex_shinc',
      rawText: 'Legacy SHEX',
      parameters: { shex: true },
      charterParty: { id: 'charter-party-1', voyageId: 'voyage-1' },
    };
    const parameters = {
      shex: true,
      calendarVersion: 1,
      timeZone: 'Europe/London',
      holidayDates: ['2026-12-25'],
      saturdayExcepted: false,
    };
    clauses.findOne.mockResolvedValueOnce(existing);
    charterParties.findOne.mockResolvedValueOnce({
      id: 'charter-party-1',
      voyageId: 'voyage-1',
      clauses: [existing],
    });

    await expect(
      service.updateClause('legacy-shex', { parameters }),
    ).resolves.toEqual(expect.objectContaining({ parameters }));
    expect(clauses.save).toHaveBeenCalledTimes(1);
  });
});

describe.each(['wibon', 'wipon'] as const)(
  'CharterPartiesService %s merged update validation',
  (clauseType) => {
    it('rejects invalid parameters-only PATCH using the persisted clause type', async () => {
      const { service, clauses } = buildService(null);
      clauses.findOne.mockResolvedValueOnce({
        id: `${clauseType}-clause`,
        charterPartyId: 'charter-party-1',
        clauseType,
        rawText: clauseType.toUpperCase(),
        parameters: { enabled: true, operation: 'Loading' },
        charterParty: { id: 'charter-party-1', voyageId: 'voyage-1' },
      });

      await expect(
        service.updateClause(`${clauseType}-clause`, {
          parameters: { enabled: 'true', operation: 'Loading' },
        }),
      ).rejects.toThrow(BadRequestException);
      expect(clauses.save).not.toHaveBeenCalled();
    });

    it('accepts a valid parameters-only PATCH', async () => {
      const { service, charterParties, clauses } = buildService(null);
      const existing = {
        id: `${clauseType}-clause`,
        charterPartyId: 'charter-party-1',
        clauseType,
        rawText: clauseType.toUpperCase(),
        parameters: { enabled: true, operation: 'Loading' },
        charterParty: { id: 'charter-party-1', voyageId: 'voyage-1' },
      };
      clauses.findOne.mockResolvedValueOnce(existing);
      charterParties.findOne.mockResolvedValueOnce({
        id: 'charter-party-1',
        voyageId: 'voyage-1',
        clauses: [existing],
      });

      await expect(
        service.updateClause(`${clauseType}-clause`, {
          parameters: { enabled: false, operation: 'Loading' },
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          parameters: { enabled: false, operation: 'Loading' },
        }),
      );
    });
  },
);
