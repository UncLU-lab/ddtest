import { getMetadataArgsStorage } from 'typeorm';
import { User } from '../modules/cross-cutting/entities/user.entity';
import { AddUserOrganization1787700000000 } from './1787700000000-add_user_organization';

describe('AddUserOrganization1787700000000', () => {
  it('adds a nullable organization relationship without assigning legacy users', async () => {
    const migration = new AddUserOrganization1787700000000();
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    } as never;

    await migration.up(queryRunner);
    await migration.down(queryRunner);

    const queries = (queryRunner as { query: jest.Mock }).query.mock.calls.map(
      ([query]: [string]) => query,
    );

    expect(queries[0]).toContain('ADD "organization_id" uuid');
    expect(queries[0]).not.toContain('DEFAULT');
    expect(queries[0]).not.toContain('NOT NULL');
    expect(queries[1]).toContain('CREATE INDEX "idx_users_organization"');
    expect(queries[2]).toContain(
      'ADD CONSTRAINT "chk_users_organization_required"',
    );
    expect(queries[2]).toContain(
      'CHECK ("organization_id" IS NOT NULL) NOT VALID',
    );
    expect(queries[3]).toContain('ADD CONSTRAINT "FK_users_organization"');
    expect(queries[4]).toContain('DROP CONSTRAINT "FK_users_organization"');
    expect(queries[5]).toContain(
      'DROP CONSTRAINT "chk_users_organization_required"',
    );
    expect(queries[6]).toContain(
      'DROP INDEX "public"."idx_users_organization"',
    );
    expect(queries[7]).toContain('DROP COLUMN "organization_id"');
  });

  it('exposes matching user organization metadata', () => {
    const column = getMetadataArgsStorage().columns.find(
      (entry) =>
        entry.target === User && entry.propertyName === 'organizationId',
    );
    const index = getMetadataArgsStorage().indices.find(
      (entry) =>
        entry.target === User && entry.name === 'idx_users_organization',
    );

    expect(column?.options).toEqual(
      expect.objectContaining({ name: 'organization_id', nullable: true }),
    );
    expect(index?.columns).toEqual(['organizationId']);
  });
});
