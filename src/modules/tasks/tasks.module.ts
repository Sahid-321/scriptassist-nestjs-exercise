import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { Task } from './entities/task.entity';
import { TaskRepository } from './repositories/task.repository';
import { TaskDomainService } from './application/task-domain.service';
import { CqrsModule } from '../../common/cqrs.module';
import { CommandBus } from '../../common/cqrs/command-bus';
import { QueryBus } from '../../common/cqrs/query-bus';
import { EventBus } from '../../common/cqrs/event-bus';

// Command Handlers
import {
  CreateTaskHandler,
  UpdateTaskHandler,
  AssignTaskHandler,
  ChangeTaskStatusHandler,
  BulkUpdateTasksHandler,
  DeleteTaskHandler,
} from './application/commands/task-command.handlers';

// Query Handlers
import {
  GetTaskByIdHandler,
  GetTasksHandler,
  GetTaskStatisticsHandler,
  GetOverdueTasksHandler,
  GetTasksByUserHandler,
} from './application/queries/task-query.handlers';

// Event Handlers
import {
  TaskCreatedHandler,
  TaskStatusChangedHandler,
  TaskAssignedHandler,
} from './application/events/task-event.handlers';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task]),
    BullModule.registerQueue({
      name: 'task-processing',
    }),
    CqrsModule, // Import CQRS module to get CommandBus, QueryBus, EventBus
  ],
  controllers: [TasksController],
  providers: [
    TasksService,
    TaskRepository,
    TaskDomainService,
    
    // Command Handlers
    CreateTaskHandler,
    UpdateTaskHandler,
    AssignTaskHandler,
    ChangeTaskStatusHandler,
    BulkUpdateTasksHandler,
    DeleteTaskHandler,
    
    // Query Handlers
    GetTaskByIdHandler,
    GetTasksHandler,
    GetTaskStatisticsHandler,
    GetOverdueTasksHandler,
    GetTasksByUserHandler,
    
    // Event Handlers
    TaskCreatedHandler,
    TaskStatusChangedHandler,
    TaskAssignedHandler,
  ],
  exports: [TasksService, TaskRepository, TaskDomainService],
})
export class TasksModule implements OnModuleInit {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly eventBus: EventBus,
  ) {}

  onModuleInit() {
    // Register Command Handlers
    this.commandBus.register('CreateTask', CreateTaskHandler);
    this.commandBus.register('UpdateTask', UpdateTaskHandler);
    this.commandBus.register('AssignTask', AssignTaskHandler);
    this.commandBus.register('ChangeTaskStatus', ChangeTaskStatusHandler);
    this.commandBus.register('BulkUpdateTasks', BulkUpdateTasksHandler);
    this.commandBus.register('DeleteTask', DeleteTaskHandler);

    // Register Query Handlers
    this.queryBus.register('GetTaskById', GetTaskByIdHandler);
    this.queryBus.register('GetTasks', GetTasksHandler);
    this.queryBus.register('GetTaskStatistics', GetTaskStatisticsHandler);
    this.queryBus.register('GetOverdueTasks', GetOverdueTasksHandler);
    this.queryBus.register('GetTasksByUser', GetTasksByUserHandler);

    // Register Event Handlers
    this.eventBus.register('TaskCreated', TaskCreatedHandler);
    this.eventBus.register('TaskStatusChanged', TaskStatusChangedHandler);
    this.eventBus.register('TaskAssigned', TaskAssignedHandler);
  }
}