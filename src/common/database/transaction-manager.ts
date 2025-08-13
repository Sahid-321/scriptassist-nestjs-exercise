import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { IUnitOfWork, ITransactionManager } from '../interfaces/repository.interface';

export class UnitOfWork implements IUnitOfWork {
  constructor(private readonly queryRunner: QueryRunner) {}

  async startTransaction(): Promise<void> {
    if (!this.queryRunner.isTransactionActive) {
      await this.queryRunner.startTransaction();
    }
  }

  async commit(): Promise<void> {
    if (this.queryRunner.isTransactionActive) {
      await this.queryRunner.commitTransaction();
    }
  }

  async rollback(): Promise<void> {
    if (this.queryRunner.isTransactionActive) {
      await this.queryRunner.rollbackTransaction();
    }
  }

  async release(): Promise<void> {
    if (!this.queryRunner.isReleased) {
      await this.queryRunner.release();
    }
  }

  getQueryRunner(): QueryRunner {
    return this.queryRunner;
  }
}

@Injectable()
export class TransactionManager implements ITransactionManager {
  constructor(private readonly dataSource: DataSource) {}

  async execute<T>(operation: (uow: UnitOfWork) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    const uow = new UnitOfWork(queryRunner);

    try {
      await uow.startTransaction();
      const result = await operation(uow);
      await uow.commit();
      return result;
    } catch (error) {
      await uow.rollback();
      throw error;
    } finally {
      await uow.release();
    }
  }
}
