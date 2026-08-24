import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { defer, lastValueFrom, Observable } from 'rxjs';
import { TenantDatabaseContextService } from './tenant-database-context.service';

@Injectable()
export class TenantDatabaseInterceptor implements NestInterceptor {
  constructor(private readonly databaseContext: TenantDatabaseContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();

    if (!request.originalUrl.startsWith('/api/v1')) {
      return next.handle();
    }

    return defer(() =>
      this.databaseContext.runInTransaction(() => lastValueFrom(next.handle())),
    );
  }
}
