import { Injectable, Logger } from '@nestjs/common';
import { IEventHandler } from '../../../../common/interfaces/event.interface';
import {
  TaskCreatedEvent,
  TaskStatusChangedEvent,
  TaskAssignedEvent,
} from '../../domain/events/task.events';

@Injectable()
export class TaskCreatedHandler implements IEventHandler<TaskCreatedEvent> {
  private readonly logger = new Logger(TaskCreatedHandler.name);

  async handle(event: TaskCreatedEvent): Promise<void> {
    this.logger.log(`Task created: ${event.payload.taskId} - ${event.payload.title}`);
    
    // Additional side effects can be implemented here:
    // - Send notification to user
    // - Update analytics
    // - Trigger workflow processes
    // - Add to search index
    
    // Example: Log for audit trail
    this.logger.debug(`New task assigned to user ${event.payload.userId}`);
  }
}

@Injectable()
export class TaskStatusChangedHandler implements IEventHandler<TaskStatusChangedEvent> {
  private readonly logger = new Logger(TaskStatusChangedHandler.name);

  async handle(event: TaskStatusChangedEvent): Promise<void> {
    this.logger.log(
      `Task status changed: ${event.payload.taskId} from ${event.payload.oldStatus} to ${event.payload.newStatus}`,
    );
    
    // Additional side effects:
    // - Send notification about status change
    // - Update project progress metrics
    // - Trigger completion workflows if status is COMPLETED
    // - Update time tracking
    
    if (event.payload.newStatus === 'COMPLETED') {
      this.logger.log(`Task ${event.payload.taskId} completed by user ${event.payload.userId}`);
      // Could trigger completion bonus calculations, notifications, etc.
    }
  }
}

@Injectable()
export class TaskAssignedHandler implements IEventHandler<TaskAssignedEvent> {
  private readonly logger = new Logger(TaskAssignedHandler.name);

  async handle(event: TaskAssignedEvent): Promise<void> {
    this.logger.log(`Task assigned: ${event.payload.taskId} to user ${event.payload.assignedToUserId}`);
    
    // Additional side effects:
    // - Send email notification to assigned user
    // - Update user workload metrics
    // - Create calendar entry
    // - Update team dashboards
    
    if (event.payload.assignedByUserId) {
      this.logger.debug(
        `Task reassigned by user ${event.payload.assignedByUserId} to ${event.payload.assignedToUserId}`,
      );
    }
  }
}
