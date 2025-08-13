import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TaskProcessorService } from './task-processor.service';
import { TasksModule } from '../../modules/tasks/tasks.module';
import { ResilienceModule } from '../../common/resilience.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'task-processing',
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }),
    TasksModule,
    ResilienceModule,
  ],
  providers: [TaskProcessorService],
  exports: [TaskProcessorService],
})
export class TaskProcessorModule {} 