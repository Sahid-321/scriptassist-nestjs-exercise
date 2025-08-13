import { IQuery } from '../../../../common/interfaces/query.interface';
import { TaskQueryDto } from '../../dto/task-query.dto';

export class GetTaskByIdQuery implements IQuery {
  readonly type = 'GetTaskById';

  constructor(readonly taskId: string) {}
}

export class GetTasksQuery implements IQuery {
  readonly type = 'GetTasks';

  constructor(readonly filters: TaskQueryDto) {}
}

export class GetTaskStatisticsQuery implements IQuery {
  readonly type = 'GetTaskStatistics';

  constructor(readonly userId?: string) {}
}

export class GetOverdueTasksQuery implements IQuery {
  readonly type = 'GetOverdueTasks';

  constructor(readonly limit = 100) {}
}

export class GetTasksByUserQuery implements IQuery {
  readonly type = 'GetTasksByUser';

  constructor(
    readonly userId: string,
    readonly filters?: Partial<TaskQueryDto>,
  ) {}
}
