import Task from './Task';
import { ParsedArgs } from 'minimist';

export interface IStepOptions {
  name?: string;
  child?: Task;
  concurrent?: boolean;
  exec?: (state: IStepState) => void;
}

export interface IStepState {
  global: IStepGlobalState;
  current: IStepCurrentState;
}

export interface IStepGlobalState {
  argv: ParsedArgs;
  get(name: string): any;
  set(name: string, value: any): void;
}

export interface IStepCurrentState {
  info(message: string): void;
  fail(message?: string): void;
  options: { [key: string]: any };
}

export enum StepStatus {
  Initial,
  Running,
  Success,
  Failure
}

export class Step {
  public child: Task;
  public name: string;
  public info: string;
  public error: Error;
  public concurrent: boolean;
  public errorMessage: string;
  public exec: (state: IStepState) => void;
  public status: StepStatus = StepStatus.Initial;

  constructor(options: IStepOptions) {
    this.name = options.name;
    this.exec = options.exec;
    this.child = options.child;
    this.concurrent = options.concurrent;
  }

  start() {
    this.status = StepStatus.Running;
  }

  success() {
    this.status = StepStatus.Success;
  }

  failure(err?: Error | string) {
    this.status = StepStatus.Failure;

    if (err instanceof Error) {
      this.error = err;
      this.errorMessage = err.message;
    } else if (typeof err == 'string') {
      this.errorMessage = err;
    }
  }
}
