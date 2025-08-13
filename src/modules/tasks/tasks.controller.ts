import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, HttpStatus, UseInterceptors, ParseUUIDPipe } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { BatchOperationDto, BatchAction } from './dto/batch-operation.dto';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { TaskStatus } from './enums/task-status.enum';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface UserPayload {
  id: string;
  email: string;
  name: string;
  role: string;
}

@ApiTags('tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard, RateLimitGuard)
@UseInterceptors(LoggingInterceptor)
@RateLimit({ limit: 100, windowMs: 60000 })
@ApiBearerAuth()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Task created successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid task data' })
  async create(@Body() createTaskDto: CreateTaskDto, @CurrentUser() user: UserPayload) {
    return this.tasksService.create(createTaskDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Find all tasks with filtering and pagination' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Tasks retrieved successfully' })
  async findAll(@Query() query: TaskQueryDto) {
    return this.tasksService.findAllPaginated(query);
  }

  @Get('my-tasks')
  @ApiOperation({ summary: 'Get current user tasks' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User tasks retrieved successfully' })
  async getMyTasks(@Query() query: TaskQueryDto, @CurrentUser() user: UserPayload) {
    return this.tasksService.getTasksByUser(user.id, query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get task statistics' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Statistics retrieved successfully' })
  async getStats() {
    return this.tasksService.getStatistics();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Find a task by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Task found successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Task not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a task' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Task updated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Task not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid update data' })
  async update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() updateTaskDto: UpdateTaskDto,
    @CurrentUser() user: UserPayload
  ) {
    return this.tasksService.update(id, updateTaskDto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a task' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Task deleted successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Task not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UserPayload) {
    await this.tasksService.remove(id, user.id);
    return { message: 'Task deleted successfully' };
  }

  @Post(':id/assign')
  @ApiOperation({ summary: 'Assign a task to another user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Task assigned successfully' })
  async assignTask(
    @Param('id', ParseUUIDPipe) taskId: string,
    @Body() assignData: { assignToUserId: string },
    @CurrentUser() user: UserPayload
  ) {
    return this.tasksService.assignTask(taskId, assignData.assignToUserId, user.id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change task status' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Task status updated successfully' })
  async changeStatus(
    @Param('id', ParseUUIDPipe) taskId: string,
    @Body() statusData: { status: TaskStatus },
    @CurrentUser() user: UserPayload
  ) {
    return this.tasksService.updateStatus(taskId, statusData.status, user.id);
  }

  @Post('batch')
  @ApiOperation({ summary: 'Batch process multiple tasks' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Batch operation completed' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid batch operation' })
  async batchProcess(@Body() batchOperation: BatchOperationDto, @CurrentUser() user: UserPayload) {
    const { taskIds, action } = batchOperation;

    try {
      switch (action) {
        case BatchAction.COMPLETE:
          await this.tasksService.bulkUpdateStatus(taskIds, TaskStatus.COMPLETED, user.id);
          break;
        case BatchAction.MARK_PENDING:
          await this.tasksService.bulkUpdateStatus(taskIds, TaskStatus.PENDING, user.id);
          break;
        case BatchAction.MARK_IN_PROGRESS:
          await this.tasksService.bulkUpdateStatus(taskIds, TaskStatus.IN_PROGRESS, user.id);
          break;
        case BatchAction.DELETE:
          await this.tasksService.bulkDelete(taskIds, user.id);
          break;
        default:
          return {
            success: false,
            message: `Unknown action: ${action}`
          };
      }

      return {
        success: true,
        message: `Successfully processed ${taskIds.length} tasks with action: ${action}`,
        processedCount: taskIds.length
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        success: false,
        message: `Batch operation failed: ${errorMessage}`
      };
    }
  }
} 