export interface ICommand {
  readonly type: string;
}

export interface ICommandHandler<T extends ICommand, R = any> {
  execute(command: T): Promise<R>;
}

export interface ICommandBus {
  execute<T extends ICommand, R = any>(command: T): Promise<R>;
}
