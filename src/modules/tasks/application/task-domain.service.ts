import { Injectable } from '@nestjs/common';
import { CommandBus } from '../../../common/cqrs/command-bus';
import { QueryBus } from '../../../common/cqrs/query-bus';
import { CreateTaskDto } from '../dto/create-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { TaskQueryDto } from '../dto/task-query.dto';
import { TaskStatus } from '../enums/task-status.enum';
import {
  CreateTaskCommand,
  UpdateTaskCommand,
  AssignTaskCommand,
  ChangeTaskStatusCommand,
  BulkUpdateTasksCommand,
  DeleteTaskCommand,
} from './commands/task.commands';
import {
  GetTaskByIdQuery,
  GetTasksQuery,
  GetTaskStatisticsQuery,
  GetOverdueTasksQuery,
  GetTasksByUserQuery,
} from './queries/task.queries';
import { Task } from '../entities/task.entity';
import { PaginatedResponse } from '../../../types/pagination.interface';

@Injectable()
export class TaskDomainService {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // Command operations (write side)
  async createTask(userId: string, taskData: CreateTaskDto): Promise<Task> {
    const command = new CreateTaskCommand(userId, taskData);
    return this.commandBus.execute(command);
  }

  async updateTask(taskId: string, userId: string, updateData: UpdateTaskDto): Promise<Task> {
    const command = new UpdateTaskCommand(taskId, userId, updateData);
    return this.commandBus.execute(command);
  }

  async assignTask(taskId: string, assignToUserId: string, assignedByUserId: string): Promise<Task> {
    const command = new AssignTaskCommand(taskId, assignToUserId, assignedByUserId);
    return this.commandBus.execute(command);
  }

  async changeTaskStatus(taskId: string, newStatus: TaskStatus, userId: string): Promise<Task> {
    const command = new ChangeTaskStatusCommand(taskId, newStatus, userId);
    return this.commandBus.execute(command);
  }

  async bulkUpdateTasks(
    taskIds: string[],
    updateData: { status?: TaskStatus; priority?: string },
    userId: string,
  ): Promise<void> {
    const command = new BulkUpdateTasksCommand(taskIds, updateData, userId);
    return this.commandBus.execute(command);
  }

  async deleteTask(taskId: string, userId: string): Promise<void> {
    const command = new DeleteTaskCommand(taskId, userId);
    return this.commandBus.execute(command);
  }

  // Query operations (read side)
  async getTaskById(taskId: string): Promise<Task> {
    const query = new GetTaskByIdQuery(taskId);
    return this.queryBus.execute(query);
  }

  async getTasks(filters: TaskQueryDto): Promise<PaginatedResponse<Task>> {
    const query = new GetTasksQuery(filters);
    return this.queryBus.execute(query);
  }

  async getTaskStatistics(userId?: string): Promise<{
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    highPriority: number;
  }> {
    const query = new GetTaskStatisticsQuery(userId);
    return this.queryBus.execute(query);
  }

  async getOverdueTasks(limit = 100): Promise<Task[]> {
    const query = new GetOverdueTasksQuery(limit);
    return this.queryBus.execute(query);
  }

  async getTasksByUser(userId: string, filters?: Partial<TaskQueryDto>): Promise<PaginatedResponse<Task>> {
    const query = new GetTasksByUserQuery(userId, filters);
    return this.queryBus.execute(query);
  }
}
