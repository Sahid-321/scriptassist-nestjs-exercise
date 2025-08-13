import { Injectable, NotFoundException } from '@nestjs/common';
import { IQueryHandler } from '../../../../common/interfaces/query.interface';
import { TaskRepository } from '../../repositories/task.repository';
import {
  GetTaskByIdQuery,
  GetTasksQuery,
  GetTaskStatisticsQuery,
  GetOverdueTasksQuery,
  GetTasksByUserQuery,
} from './task.queries';
import { Task } from '../../entities/task.entity';
import { PaginatedResponse } from '../../../../types/pagination.interface';

@Injectable()
export class GetTaskByIdHandler implements IQueryHandler<GetTaskByIdQuery> {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(query: GetTaskByIdQuery): Promise<Task> {
    const task = await this.taskRepository.findOneWithUser(query.taskId);
    if (!task) {
      throw new NotFoundException(`Task with ID ${query.taskId} not found`);
    }
    return task;
  }
}

@Injectable()
export class GetTasksHandler implements IQueryHandler<GetTasksQuery> {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(query: GetTasksQuery): Promise<PaginatedResponse<Task>> {
    return this.taskRepository.findAllPaginated(query.filters);
  }
}

@Injectable()
export class GetTaskStatisticsHandler implements IQueryHandler<GetTaskStatisticsQuery> {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(query: GetTaskStatisticsQuery): Promise<{
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    highPriority: number;
  }> {
    return this.taskRepository.getTaskStatistics();
  }
}

@Injectable()
export class GetOverdueTasksHandler implements IQueryHandler<GetOverdueTasksQuery> {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(query: GetOverdueTasksQuery): Promise<Task[]> {
    return this.taskRepository.findOverdueTasks(query.limit);
  }
}

@Injectable()
export class GetTasksByUserHandler implements IQueryHandler<GetTasksByUserQuery> {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(query: GetTasksByUserQuery): Promise<PaginatedResponse<Task>> {
    const filters = {
      ...query.filters,
      userId: query.userId,
    };
    return this.taskRepository.findAllPaginated(filters);
  }
}
