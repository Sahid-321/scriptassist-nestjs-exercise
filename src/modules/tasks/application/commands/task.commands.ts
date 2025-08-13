import { ICommand } from '../../../../common/interfaces/command.interface';
import { CreateTaskDto } from '../../dto/create-task.dto';
import { UpdateTaskDto } from '../../dto/update-task.dto';
import { TaskStatus } from '../../enums/task-status.enum';

export class CreateTaskCommand implements ICommand {
  readonly type = 'CreateTask';

  constructor(
    readonly userId: string,
    readonly taskData: CreateTaskDto,
  ) {}
}

export class UpdateTaskCommand implements ICommand {
  readonly type = 'UpdateTask';

  constructor(
    readonly taskId: string,
    readonly userId: string,
    readonly updateData: UpdateTaskDto,
  ) {}
}

export class AssignTaskCommand implements ICommand {
  readonly type = 'AssignTask';

  constructor(
    readonly taskId: string,
    readonly assignToUserId: string,
    readonly assignedByUserId: string,
  ) {}
}

export class ChangeTaskStatusCommand implements ICommand {
  readonly type = 'ChangeTaskStatus';

  constructor(
    readonly taskId: string,
    readonly newStatus: TaskStatus,
    readonly userId: string,
  ) {}
}

export class BulkUpdateTasksCommand implements ICommand {
  readonly type = 'BulkUpdateTasks';

  constructor(
    readonly taskIds: string[],
    readonly updateData: { status?: TaskStatus; priority?: string },
    readonly userId: string,
  ) {}
}

export class DeleteTaskCommand implements ICommand {
  readonly type = 'DeleteTask';

  constructor(
    readonly taskId: string,
    readonly userId: string,
  ) {}
}
