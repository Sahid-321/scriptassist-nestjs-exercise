import { IsArray, IsEnum, IsNotEmpty, ArrayMinSize, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum BatchAction {
  COMPLETE = 'complete',
  DELETE = 'delete',
  MARK_PENDING = 'mark-pending',
  MARK_IN_PROGRESS = 'mark-in-progress',
}

export class BatchOperationDto {
  @ApiProperty({ 
    example: ['550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001'],
    description: 'Array of task IDs to process'
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one task ID is required' })
  @IsUUID('4', { each: true, message: 'Each task ID must be a valid UUID' })
  taskIds: string[];

  @ApiProperty({ 
    enum: BatchAction,
    example: BatchAction.COMPLETE,
    description: 'Action to perform on the tasks'
  })
  @IsEnum(BatchAction, { message: 'Action must be one of: complete, delete, mark-pending, mark-in-progress' })
  @IsNotEmpty()
  action: BatchAction;
}
