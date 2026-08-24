import { UnauthorizedException, Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantRequestContext {
  organizationId: string;
  userId: string;
  providerIdentity: string;
  authenticationProvider: 'firebase' | 'development';
}

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantRequestContext>();

  run<T>(context: TenantRequestContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  getContext(): TenantRequestContext {
    const context = this.storage.getStore();

    if (!context) {
      throw new UnauthorizedException(
        'Authenticated request context is required',
      );
    }

    return context;
  }

  getOrganizationId(): string {
    return this.getContext().organizationId;
  }

  getUserId(): string {
    return this.getContext().userId;
  }
}
