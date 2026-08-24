import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface AuthenticatedUserTenant {
  userId: string;
  organizationId: string | null;
  organizationExists: boolean;
}

interface AuthenticatedUserTenantRow {
  user_id: string;
  organization_id: string | null;
  organization_exists: boolean;
}

@Injectable()
export class AuthenticatedUserResolverService {
  constructor(private readonly dataSource: DataSource) {}

  async resolve(
    providerIdentity: string,
  ): Promise<AuthenticatedUserTenant | null> {
    const rows = await this.dataSource.query<AuthenticatedUserTenantRow[]>(
      `SELECT user_id, organization_id, organization_exists
       FROM app.resolve_authenticated_user($1)`,
      [providerIdentity],
    );
    const row = rows[0];

    if (!row) {
      return null;
    }

    return {
      userId: row.user_id,
      organizationId: row.organization_id,
      organizationExists: row.organization_exists,
    };
  }
}
