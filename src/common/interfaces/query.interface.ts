export interface IQuery {
  readonly type: string;
}

export interface IQueryHandler<T extends IQuery, R = any> {
  execute(query: T): Promise<R>;
}

export interface IQueryBus {
  execute<T extends IQuery, R = any>(query: T): Promise<R>;
}
