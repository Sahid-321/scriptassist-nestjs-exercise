import { Injectable, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ICommand, ICommandHandler, ICommandBus } from '../interfaces/command.interface';

@Injectable()
export class CommandBus implements ICommandBus {
  private readonly handlers = new Map<string, Type<ICommandHandler<any>>>();

  constructor(private readonly moduleRef: ModuleRef) {}

  register<T extends ICommand>(
    commandType: string,
    handler: Type<ICommandHandler<T>>,
  ): void {
    this.handlers.set(commandType, handler);
  }

  async execute<T extends ICommand, R = any>(command: T): Promise<R> {
    const handlerType = this.handlers.get(command.type);
    
    if (!handlerType) {
      throw new Error(`No handler registered for command type: ${command.type}`);
    }

    const handler = this.moduleRef.get(handlerType, { strict: false });
    return handler.execute(command);
  }
}
