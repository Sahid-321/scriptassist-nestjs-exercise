import { Injectable, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { IDomainEvent, IEventHandler, IEventBus } from '../interfaces/event.interface';

@Injectable()
export class EventBus implements IEventBus {
  private readonly handlers = new Map<string, Type<IEventHandler<any>>[]>();

  constructor(private readonly moduleRef: ModuleRef) {}

  register<T extends IDomainEvent>(
    eventType: string,
    handler: Type<IEventHandler<T>>,
  ): void {
    const existingHandlers = this.handlers.get(eventType) || [];
    existingHandlers.push(handler);
    this.handlers.set(eventType, existingHandlers);
  }

  async publish(event: IDomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType) || [];
    
    const handlerPromises = handlers.map(async (handlerType) => {
      const handler = this.moduleRef.get(handlerType, { strict: false });
      return handler.handle(event);
    });

    await Promise.all(handlerPromises);
  }

  async publishAll(events: IDomainEvent[]): Promise<void> {
    const publishPromises = events.map(event => this.publish(event));
    await Promise.all(publishPromises);
  }
}
