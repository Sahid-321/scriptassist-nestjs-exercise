import { v4 as uuidv4 } from 'uuid';
import { IDomainEvent } from '../../../../common/interfaces/event.interface';

export class TaskCreatedEvent implements IDomainEvent {
  readonly eventId = uuidv4();
  readonly eventType = 'TaskCreated';
  readonly occurredOn = new Date();

  constructor(
    readonly aggregateId: string,
    readonly aggregateVersion: number,
    readonly payload: {
      taskId: string;
      title: string;
      userId: string;
      status: string;
      priority: string;
      dueDate?: Date;
    },
  ) {}
}

export class TaskStatusChangedEvent implements IDomainEvent {
  readonly eventId = uuidv4();
  readonly eventType = 'TaskStatusChanged';
  readonly occurredOn = new Date();

  constructor(
    readonly aggregateId: string,
    readonly aggregateVersion: number,
    readonly payload: {
      taskId: string;
      oldStatus: string;
      newStatus: string;
      userId: string;
    },
  ) {}
}

export class TaskAssignedEvent implements IDomainEvent {
  readonly eventId = uuidv4();
  readonly eventType = 'TaskAssigned';
  readonly occurredOn = new Date();

  constructor(
    readonly aggregateId: string,
    readonly aggregateVersion: number,
    readonly payload: {
      taskId: string;
      assignedToUserId: string;
      assignedByUserId?: string;
    },
  ) {}
}
