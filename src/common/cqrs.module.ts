import { Module, Global } from '@nestjs/common';
import { CommandBus } from './cqrs/command-bus';
import { QueryBus } from './cqrs/query-bus';
import { EventBus } from './cqrs/event-bus';
import { TransactionManager } from './database/transaction-manager';

@Global()
@Module({
  providers: [
    CommandBus,
    QueryBus,
    EventBus,
    TransactionManager,
  ],
  exports: [
    CommandBus,
    QueryBus,
    EventBus,
    TransactionManager,
  ],
})
export class CqrsModule {}
