import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Task } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TaskStatus } from './enums/task-status.enum';
import { TaskRepository } from './repositories/task.repository';
import { PaginatedResponse } from '../../types/pagination.interface';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly dataSource: DataSource,
    @InjectQueue('task-processing')
    private readonly taskQueue: Queue,
  ) {}

  async create(createTaskDto: CreateTaskDto): Promise<Task> {
    // Use transaction to ensure consistency
    return this.dataSource.transaction(async (manager) => {
      try {
        const task = manager.create(Task, createTaskDto);
        const savedTask = await manager.save(task);

        // Add to queue within transaction context for better error handling
        await this.taskQueue.add('task-created', {
          taskId: savedTask.id,
          status: savedTask.status,
          userId: savedTask.userId,
        });

        this.logger.log(`Task created: ${savedTask.id}`);
        return savedTask;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(`Failed to create task: ${errorMessage}`, errorStack);
        throw new BadRequestException('Failed to create task');
      }
    });
  }

  async findAllPaginated(query: TaskQueryDto): Promise<PaginatedResponse<Task>> {
    try {
      return await this.taskRepository.findAllPaginated(query);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to fetch tasks: ${errorMessage}`, errorStack);
      throw new BadRequestException('Failed to fetch tasks');
    }
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.taskRepository.findOneWithUser(id);
    
    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    return this.dataSource.transaction(async (manager) => {
      try {
        const task = await this.taskRepository.findById(id);
        
        if (!task) {
          throw new NotFoundException(`Task with ID ${id} not found`);
        }

        const originalStatus = task.status;

        // Merge updates
        Object.assign(task, updateTaskDto);
        task.updatedAt = new Date();

        const updatedTask = await manager.save(task);

        // Queue status change notification if status changed
        if (originalStatus !== updatedTask.status) {
          await this.taskQueue.add('task-status-updated', {
            taskId: updatedTask.id,
            oldStatus: originalStatus,
            newStatus: updatedTask.status,
            userId: updatedTask.userId,
          });
        }

        this.logger.log(`Task updated: ${updatedTask.id}`);
        return updatedTask;
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw error;
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(`Failed to update task ${id}: ${errorMessage}`, errorStack);
        throw new BadRequestException('Failed to update task');
      }
    });
  }

  async remove(id: string): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      try {
        const task = await this.taskRepository.findById(id);
        
        if (!task) {
          throw new NotFoundException(`Task with ID ${id} not found`);
        }

        await manager.remove(task);

        // Queue cleanup notification
        await this.taskQueue.add('task-deleted', {
          taskId: id,
          userId: task.userId,
        });

        this.logger.log(`Task deleted: ${id}`);
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw error;
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(`Failed to delete task ${id}: ${errorMessage}`, errorStack);
        throw new BadRequestException('Failed to delete task');
      }
    });
  }

  async findByStatus(status: TaskStatus): Promise<Task[]> {
    try {
      const query = new TaskQueryDto();
      query.status = status;
      query.limit = 1000; // Set a reasonable limit
      
      const result = await this.taskRepository.findAllPaginated(query);
      return result.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to fetch tasks by status ${status}: ${errorMessage}`, errorStack);
      throw new BadRequestException('Failed to fetch tasks by status');
    }
  }

  async updateStatus(id: string, status: TaskStatus): Promise<Task> {
    return this.update(id, { status });
  }

  async getStatistics(): Promise<{
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    highPriority: number;
  }> {
    try {
      return await this.taskRepository.getTaskStatistics();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get task statistics: ${errorMessage}`, errorStack);
      throw new BadRequestException('Failed to get task statistics');
    }
  }

  async bulkUpdateStatus(taskIds: string[], status: TaskStatus): Promise<void> {
    if (taskIds.length === 0) {
      return;
    }

    return this.dataSource.transaction(async () => {
      try {
        await this.taskRepository.bulkUpdateStatus(taskIds, status);

        // Queue bulk status update notification
        await this.taskQueue.add('tasks-bulk-updated', {
          taskIds,
          newStatus: status,
          updatedAt: new Date(),
        });

        this.logger.log(`Bulk updated ${taskIds.length} tasks to status: ${status}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(`Failed to bulk update tasks: ${errorMessage}`, errorStack);
        throw new BadRequestException('Failed to bulk update tasks');
      }
    });
  }

  async bulkDelete(taskIds: string[]): Promise<void> {
    if (taskIds.length === 0) {
      return;
    }

    return this.dataSource.transaction(async () => {
      try {
        // Get tasks before deletion for audit purposes
        const tasks = await this.taskRepository.findByIds(taskIds);
        
        await this.taskRepository.bulkDelete(taskIds);

        // Queue bulk deletion notification
        await this.taskQueue.add('tasks-bulk-deleted', {
          taskIds,
          userIds: tasks.map(task => task.userId),
          deletedAt: new Date(),
        });

        this.logger.log(`Bulk deleted ${taskIds.length} tasks`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(`Failed to bulk delete tasks: ${errorMessage}`, errorStack);
        throw new BadRequestException('Failed to bulk delete tasks');
      }
    });
  }

  async findOverdueTasks(limit = 100): Promise<Task[]> {
    try {
      return await this.taskRepository.findOverdueTasks(limit);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to fetch overdue tasks: ${errorMessage}`, errorStack);
      throw new BadRequestException('Failed to fetch overdue tasks');
    }
  }
}
