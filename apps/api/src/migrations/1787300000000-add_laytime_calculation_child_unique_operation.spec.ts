import { getMetadataArgsStorage } from 'typeorm';
import { LaytimeCalculation } from '../modules/bulk/entities/laytime-calculation.entity';
import { AddLaytimeCalculationChildUniqueOperation1787300000000 } from './1787300000000-add_laytime_calculation_child_unique_operation';

describe('AddLaytimeCalculationChildUniqueOperation1787300000000', () => {
  it('creates a partial unique index for child laytime calculations and removes it on rollback', async () => {
    const migration = new AddLaytimeCalculationChildUniqueOperation1787300000000();
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    } as never;

    await migration.up(queryRunner);
    await migration.down(queryRunner);

    expect((queryRunner as { query: jest.Mock }).query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('CREATE UNIQUE INDEX "uq_laytime_calc_parent_operation_child"'),
    );
    expect((queryRunner as { query: jest.Mock }).query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('WHERE "parent_calculation_id" IS NOT NULL'),
    );
    expect((queryRunner as { query: jest.Mock }).query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('DROP INDEX "uq_laytime_calc_parent_operation_child"'),
    );
  });

  it('exposes matching unique partial index metadata on LaytimeCalculation', () => {
    const index = getMetadataArgsStorage().indices.find(
      (entry) =>
        entry.target === LaytimeCalculation &&
        entry.name === 'uq_laytime_calc_parent_operation_child',
    );

    expect(index).toEqual(
      expect.objectContaining({
        columns: ['parentCalculationId', 'operation'],
        unique: true,
        where: '"parent_calculation_id" IS NOT NULL',
      }),
    );
  });
});
