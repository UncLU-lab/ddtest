import { AddVoyageBulkOperationType1787400000000 } from './1787400000000-add_voyage_bulk_operation_type';

describe('AddVoyageBulkOperationType1787400000000', () => {
  it('adds and removes the bulk operation type column safely', async () => {
    const migration = new AddVoyageBulkOperationType1787400000000();
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    } as never;

    await migration.up(queryRunner);
    await migration.down(queryRunner);

    expect((queryRunner as { query: jest.Mock }).query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('ADD "bulk_operation_type" character varying(20)'),
    );
    expect((queryRunner as { query: jest.Mock }).query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('ADD CONSTRAINT "chk_voyages_bulk_operation_type"'),
    );
    expect((queryRunner as { query: jest.Mock }).query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('DROP CONSTRAINT "chk_voyages_bulk_operation_type"'),
    );
    expect((queryRunner as { query: jest.Mock }).query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('DROP COLUMN "bulk_operation_type"'),
    );
  });
});
