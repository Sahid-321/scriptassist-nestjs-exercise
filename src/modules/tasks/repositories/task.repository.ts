import { Injectable } from '@nestjs/common';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Task } from '../entities/task.entity';
import { TaskQueryDto } from '../dto/task-query.dto';
import { PaginatedResponse } from '../../../types/pagination.interface';
import { TaskStatus } from '../enums/task-status.enum';

@Injectable()
export class TaskRepository {
  constructor(
    @InjectRepository(Task)
    private readonly repository: Repository<Task>,
  ) {}

  async findOneWithUser(id: string): Promise<Task | null> {
    // Use join to avoid N+1 query problem
    return this.repository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.user', 'user')
      .where('task.id = :id', { id })
      .getOne();
  }

  async findAllPaginated(query: TaskQueryDto): Promise<PaginatedResponse<Task>> {
    const queryBuilder = this.createFilteredQuery(query);
    
    // Add sorting
    const { sortBy = 'createdAt', sortOrder = 'DESC' } = query;
    const allowedSortFields = ['title', 'status', 'priority', 'dueDate', 'createdAt', 'updatedAt'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    
    queryBuilder.orderBy(`task.${sortField}`, sortOrder);
    
    // Apply pagination
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    
    queryBuilder.skip(skip).take(limit);
    
    // Execute query with count
    const [data, total] = await queryBuilder.getManyAndCount();
    
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByIds(ids: string[]): Promise<Task[]> {
    if (ids.length === 0) return [];
    
    return this.repository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.user', 'user')
      .where('task.id IN (:...ids)', { ids })
      .getMany();
  }

  async bulkUpdateStatus(ids: string[], status: TaskStatus): Promise<void> {
    if (ids.length === 0) return;
    
    await this.repository
      .createQueryBuilder()
      .update(Task)
      .set({ 
        status,
        updatedAt: () => 'CURRENT_TIMESTAMP'
      })
      .where('id IN (:...ids)', { ids })
      .execute();
  }

  async bulkDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    
    await this.repository
      .createQueryBuilder()
      .delete()
      .from(Task)
      .where('id IN (:...ids)', { ids })
      .execute();
  }

  async getTaskStatistics(): Promise<{
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    highPriority: number;
  }> {
    // Use database aggregation instead of in-memory filtering
    const stats = await this.repository
      .createQueryBuilder('task')
      .select([
        'COUNT(*) as total',
        `COUNT(CASE WHEN task.status = '${TaskStatus.COMPLETED}' THEN 1 END) as completed`,
        `COUNT(CASE WHEN task.status = '${TaskStatus.IN_PROGRESS}' THEN 1 END) as "inProgress"`,
        `COUNT(CASE WHEN task.status = '${TaskStatus.PENDING}' THEN 1 END) as pending`,
        `COUNT(CASE WHEN task.priority = 'HIGH' THEN 1 END) as "highPriority"`,
      ])
      .getRawOne();

    return {
      total: parseInt(stats.total),
      completed: parseInt(stats.completed),
      inProgress: parseInt(stats.inProgress),
      pending: parseInt(stats.pending),
      highPriority: parseInt(stats.highPriority),
    };
  }

  async findOverdueTasks(limit = 100): Promise<Task[]> {
    return this.repository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.user', 'user')
      .where('task.dueDate < :now', { now: new Date() })
      .andWhere('task.status != :completedStatus', { completedStatus: TaskStatus.COMPLETED })
      .orderBy('task.dueDate', 'ASC')
      .limit(limit)
      .getMany();
  }

  private createFilteredQuery(query: TaskQueryDto): SelectQueryBuilder<Task> {
    const queryBuilder = this.repository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.user', 'user');

    // Apply filters
    if (query.status) {
      queryBuilder.andWhere('task.status = :status', { status: query.status });
    }

    if (query.priority) {
      queryBuilder.andWhere('task.priority = :priority', { priority: query.priority });
    }

    if (query.userId) {
      queryBuilder.andWhere('task.userId = :userId', { userId: query.userId });
    }

    if (query.search) {
      queryBuilder.andWhere(
        '(task.title ILIKE :search OR task.description ILIKE :search)',
        { search: `%${query.search}%` }
      );
    }

    if (query.dueDateFrom) {
      queryBuilder.andWhere('task.dueDate >= :dueDateFrom', { 
        dueDateFrom: new Date(query.dueDateFrom) 
      });
    }

    if (query.dueDateTo) {
      queryBuilder.andWhere('task.dueDate <= :dueDateTo', { 
        dueDateTo: new Date(query.dueDateTo) 
      });
    }

    return queryBuilder;
  }

  // Standard repository methods
  async save(task: Task): Promise<Task> {
    return this.repository.save(task);
  }

  async create(taskData: Partial<Task>): Promise<Task> {
    const task = this.repository.create(taskData);
    return this.repository.save(task);
  }

  async findById(id: string): Promise<Task | null> {
    return this.repository.findOne({ where: { id } });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
