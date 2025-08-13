import { Injectable, Logger } from '@nestjs/common';
import { TaskDomainService } from './application/task-domain.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { TaskStatus } from './enums/task-status.enum';
import { Task } from './entities/task.entity';
import { PaginatedResponse } from '../../types/pagination.interface';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly taskDomainService: TaskDomainService,
    @InjectQueue('task-processing')
    private readonly taskQueue: Queue,
  ) {}

  async create(createTaskDto: CreateTaskDto, userId?: string): Promise<Task> {
    const actualUserId = userId || createTaskDto.userId;
    if (!actualUserId) {
      throw new Error('User ID is required');
    }

    const task = await this.taskDomainService.createTask(actualUserId, createTaskDto);
    
    // Add to queue for background processing
    await this.taskQueue.add('task-created', {
      taskId: task.id,
      status: task.status,
      userId: task.userId,
    });

    this.logger.log(`Task created: ${task.id}`);
    return task;
  }

  async findAllPaginated(query: TaskQueryDto): Promise<PaginatedResponse<Task>> {
    return this.taskDomainService.getTasks(query);
  }

  async findOne(id: string): Promise<Task> {
    return this.taskDomainService.getTaskById(id);
  }

  async update(id: string, updateTaskDto: UpdateTaskDto, userId?: string): Promise<Task> {
    if (!userId) {
      throw new Error('User ID is required for task updates');
    }

    const task = await this.taskDomainService.updateTask(id, userId, updateTaskDto);
    
    this.logger.log(`Task updated: ${task.id}`);
    return task;
  }

  async remove(id: string, userId?: string): Promise<void> {
    if (!userId) {
      throw new Error('User ID is required for task deletion');
    }

    await this.taskDomainService.deleteTask(id, userId);
    
    // Queue cleanup notification
    await this.taskQueue.add('task-deleted', {
      taskId: id,
      userId,
    });

    this.logger.log(`Task deleted: ${id}`);
  }

  async findByStatus(status: TaskStatus): Promise<Task[]> {
    const query = new TaskQueryDto();
    query.status = status;
    query.limit = 1000;
    
    const result = await this.taskDomainService.getTasks(query);
    return result.data;
  }

  async updateStatus(id: string, status: TaskStatus, userId: string): Promise<Task> {
    return this.taskDomainService.changeTaskStatus(id, status, userId);
  }

  async getStatistics(): Promise<{
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    highPriority: number;
  }> {
    return this.taskDomainService.getTaskStatistics();
  }

  async bulkUpdateStatus(taskIds: string[], status: TaskStatus, userId?: string): Promise<void> {
    if (!userId) {
      throw new Error('User ID is required for bulk operations');
    }

    if (taskIds.length === 0) {
      return;
    }

    await this.taskDomainService.bulkUpdateTasks(taskIds, { status }, userId);

    // Queue bulk status update notification
    await this.taskQueue.add('tasks-bulk-updated', {
      taskIds,
      newStatus: status,
      updatedAt: new Date(),
    });

    this.logger.log(`Bulk updated ${taskIds.length} tasks to status: ${status}`);
  }

  async bulkDelete(taskIds: string[], userId?: string): Promise<void> {
    if (!userId) {
      throw new Error('User ID is required for bulk operations');
    }

    if (taskIds.length === 0) {
      return;
    }

    // Use individual delete commands for proper authorization
    const deletePromises = taskIds.map(taskId => 
      this.taskDomainService.deleteTask(taskId, userId)
    );
    await Promise.all(deletePromises);

    // Queue bulk deletion notification
    await this.taskQueue.add('tasks-bulk-deleted', {
      taskIds,
      userIds: [userId],
      deletedAt: new Date(),
    });

    this.logger.log(`Bulk deleted ${taskIds.length} tasks`);
  }

  async findOverdueTasks(limit = 100): Promise<Task[]> {
    return this.taskDomainService.getOverdueTasks(limit);
  }

  async assignTask(taskId: string, assignToUserId: string, assignedByUserId: string): Promise<Task> {
    return this.taskDomainService.assignTask(taskId, assignToUserId, assignedByUserId);
  }

  async getTasksByUser(userId: string, filters?: Partial<TaskQueryDto>): Promise<PaginatedResponse<Task>> {
    return this.taskDomainService.getTasksByUser(userId, filters);
  }
}
