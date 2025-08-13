import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ICommandHandler } from '../../../../common/interfaces/command.interface';
import { EventBus } from '../../../../common/cqrs/event-bus';
import { TransactionManager } from '../../../../common/database/transaction-manager';
import { TaskRepository } from '../../repositories/task.repository';
import {
  CreateTaskCommand,
  UpdateTaskCommand,
  AssignTaskCommand,
  ChangeTaskStatusCommand,
  BulkUpdateTasksCommand,
  DeleteTaskCommand,
} from './task.commands';
import {
  TaskCreatedEvent,
  TaskStatusChangedEvent,
  TaskAssignedEvent,
} from '../../domain/events/task.events';
import { Task } from '../../entities/task.entity';

@Injectable()
export class CreateTaskHandler implements ICommandHandler<CreateTaskCommand> {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly eventBus: EventBus,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(command: CreateTaskCommand): Promise<Task> {
    return this.transactionManager.execute(async (uow) => {
      const task = await this.taskRepository.create({
        ...command.taskData,
        userId: command.userId,
      });

      const event = new TaskCreatedEvent(
        task.id,
        1,
        {
          taskId: task.id,
          title: task.title,
          userId: task.userId,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
        },
      );

      await this.eventBus.publish(event);
      return task;
    });
  }
}

@Injectable()
export class UpdateTaskHandler implements ICommandHandler<UpdateTaskCommand> {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly eventBus: EventBus,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(command: UpdateTaskCommand): Promise<Task> {
    return this.transactionManager.execute(async (uow) => {
      const existingTask = await this.taskRepository.findById(command.taskId);
      if (!existingTask) {
        throw new NotFoundException(`Task with ID ${command.taskId} not found`);
      }

      // Authorization check: only task owner can update
      if (existingTask.userId !== command.userId) {
        throw new ForbiddenException('You can only update your own tasks');
      }

      const oldStatus = existingTask.status;
      Object.assign(existingTask, command.updateData);
      const updatedTask = await this.taskRepository.save(existingTask);

      // Publish status change event if status was updated
      if (command.updateData.status && oldStatus !== command.updateData.status) {
        const event = new TaskStatusChangedEvent(
          updatedTask.id,
          2,
          {
            taskId: updatedTask.id,
            oldStatus,
            newStatus: command.updateData.status,
            userId: command.userId,
          },
        );
        await this.eventBus.publish(event);
      }

      return updatedTask;
    });
  }
}

@Injectable()
export class AssignTaskHandler implements ICommandHandler<AssignTaskCommand> {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly eventBus: EventBus,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(command: AssignTaskCommand): Promise<Task> {
    return this.transactionManager.execute(async (uow) => {
      const task = await this.taskRepository.findById(command.taskId);
      if (!task) {
        throw new NotFoundException(`Task with ID ${command.taskId} not found`);
      }

      task.userId = command.assignToUserId;
      const updatedTask = await this.taskRepository.save(task);

      const event = new TaskAssignedEvent(
        updatedTask.id,
        3,
        {
          taskId: updatedTask.id,
          assignedToUserId: command.assignToUserId,
          assignedByUserId: command.assignedByUserId,
        },
      );

      await this.eventBus.publish(event);
      return updatedTask;
    });
  }
}

@Injectable()
export class ChangeTaskStatusHandler implements ICommandHandler<ChangeTaskStatusCommand> {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly eventBus: EventBus,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(command: ChangeTaskStatusCommand): Promise<Task> {
    return this.transactionManager.execute(async (uow) => {
      const task = await this.taskRepository.findById(command.taskId);
      if (!task) {
        throw new NotFoundException(`Task with ID ${command.taskId} not found`);
      }

      const oldStatus = task.status;
      task.status = command.newStatus;
      const updatedTask = await this.taskRepository.save(task);

      const event = new TaskStatusChangedEvent(
        updatedTask.id,
        4,
        {
          taskId: updatedTask.id,
          oldStatus,
          newStatus: command.newStatus,
          userId: command.userId,
        },
      );

      await this.eventBus.publish(event);
      return updatedTask;
    });
  }
}

@Injectable()
export class BulkUpdateTasksHandler implements ICommandHandler<BulkUpdateTasksCommand> {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(command: BulkUpdateTasksCommand): Promise<void> {
    return this.transactionManager.execute(async (uow) => {
      if (command.updateData.status) {
        await this.taskRepository.bulkUpdateStatus(command.taskIds, command.updateData.status);
      }
      // Additional bulk operations can be added here
    });
  }
}

@Injectable()
export class DeleteTaskHandler implements ICommandHandler<DeleteTaskCommand> {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(command: DeleteTaskCommand): Promise<void> {
    return this.transactionManager.execute(async (uow) => {
      const task = await this.taskRepository.findById(command.taskId);
      if (!task) {
        throw new NotFoundException(`Task with ID ${command.taskId} not found`);
      }

      // Authorization check: only task owner can delete
      if (task.userId !== command.userId) {
        throw new ForbiddenException('You can only delete your own tasks');
      }

      await this.taskRepository.delete(command.taskId);
    });
  }
}
