import { Injectable, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { IQuery, IQueryHandler, IQueryBus } from '../interfaces/query.interface';

@Injectable()
export class QueryBus implements IQueryBus {
  private readonly handlers = new Map<string, Type<IQueryHandler<any>>>();

  constructor(private readonly moduleRef: ModuleRef) {}

  register<T extends IQuery>(
    queryType: string,
    handler: Type<IQueryHandler<T>>,
  ): void {
    this.handlers.set(queryType, handler);
  }

  async execute<T extends IQuery, R = any>(query: T): Promise<R> {
    const handlerType = this.handlers.get(query.type);
    
    if (!handlerType) {
      throw new Error(`No handler registered for query type: ${query.type}`);
    }

    const handler = this.moduleRef.get(handlerType, { strict: false });
    return handler.execute(query);
  }
}
