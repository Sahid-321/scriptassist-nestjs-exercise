import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  UseGuards, 
  Query, 
  HttpStatus, 
  UseInterceptors, 
  ParseUUIDPipe,
  UseFilters,
  UsePipes,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { BatchOperationDto, BatchAction } from './dto/batch-operation.dto';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { TaskStatus } from './enums/task-status.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EnhancedRateLimit } from '../../common/guards/enhanced-rate-limit.guard';
import { EnhancedAuthorizationGuard, RequirePermissions, RequireRoles } from '../../common/guards/enhanced-authorization.guard';
import { EnhancedValidationPipe } from '../../common/pipes/enhanced-validation.pipe';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
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
@UseGuards(JwtAuthGuard, EnhancedAuthorizationGuard)
@UseInterceptors(LoggingInterceptor)
@UseFilters(HttpExceptionFilter)
@UsePipes(EnhancedValidationPipe)
@ApiBearerAuth()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Task created successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid task data' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Rate limit exceeded' })
  @RequirePermissions('task:create')
  @EnhancedRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 task creations per minute
  })
  async create(@Body() createTaskDto: CreateTaskDto, @CurrentUser() user: UserPayload) {
    return this.tasksService.create(createTaskDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List tasks with filtering and pagination' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Tasks retrieved successfully' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Rate limit exceeded' })
  @RequirePermissions('task:read')
  @RequireRoles('admin', 'manager')
  @EnhancedRateLimit({
    windowMs: 60 * 1000,
    maxRequests: 100,
  })
  async findAll(@Query() query: TaskQueryDto) {
    return this.tasksService.findAllPaginated(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task details' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Task found successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Task not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied to this task' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Rate limit exceeded' })
  @RequirePermissions('task:read')
  @EnhancedRateLimit({
    windowMs: 60 * 1000,
    maxRequests: 100,
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UserPayload) {
    return this.tasksService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a task' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Task updated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Task not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid update data' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Cannot update this task' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Rate limit exceeded' })
  @RequirePermissions('task:update')
  @EnhancedRateLimit({
    windowMs: 60 * 1000,
    maxRequests: 30,
  })
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
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Cannot delete this task' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Rate limit exceeded' })
  @RequirePermissions('task:delete')
  @EnhancedRateLimit({
    windowMs: 60 * 1000,
    maxRequests: 20,
  })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UserPayload) {
    await this.tasksService.remove(id, user.id);
    return { message: 'Task deleted successfully' };
  }

  @Post('batch')
  @ApiOperation({ summary: 'Batch operations on tasks' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Batch operation completed successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid batch operation data' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions for batch operations' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Rate limit exceeded' })
  @RequirePermissions('task:update', 'task:delete')
  @RequireRoles('admin', 'manager')
  @EnhancedRateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 5, // Very limited batch operations for security
  })
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