import * as minimist from 'minimist';
import { Renderer, IRendererOptions } from './Renderer';
import { Step, IStepOptions, IStepState, StepStatus } from './Step';

export default class Task {
  public steps: Step[] = [];
  private options: { [key: string]: any; } = {};
  private stateValues: { [key: string]: any; } = {};

  constructor() {
    let handleError = (err: Error) => {
      if (this.getCurrentTask()) {
        this.getCurrentTask().failure(err);
      } else {
        throw err;
      }

      process.exit(1);
    };

    process.on('uncaughtException', handleError);
    process.on('unhandledRejection', handleError);
  }

  add(step: Task | IStepOptions | ((state: IStepState) => void)) {
    if (step instanceof Task) {
      this.steps.push(new Step({
        child: step
      }));
    } else if (step instanceof Function) {
      this.steps.push(new Step({
        exec: step
      }));
    } else {
      // task: ITaskOptions
      this.steps.push(new Step(step));
    }

    return this;
  }

  exec(options?: IRendererOptions) {
    new Renderer(this, options);

    return this.execTasks(this);
  }

  withOptions(options: { [key: string]: any; }) {
    this.options = options;
  }

  private getCurrentTask() {
    let queue = this.steps.slice();

    while (queue.length) {
      let task = queue.pop();

      if (task.status == StepStatus.Running) {
        if (task.child) {
          queue.push(...task.child.steps);
        } else {
          return task;
        }
      }
    }
  }

  private async execTasks(task: Task) {
    for (let i = 0; i < task.steps.length; i++) {
      await this.execTask(task.steps[i], task.options);
    }
  }

  private execTask(step: Step, options: { [key: string]: any }) {
    return new Promise((resolve, reject) => {
      step.start();

      let done = () => {
        step.success();
        resolve();
      };

      let result: any;
      if (step.exec) {
        try {
          result = step.exec(this.generateState(options));
        } catch (err) {
          step.failure(err);
        }
      }

      if (step.status == StepStatus.Failure) {
        reject();
      }

      if (step.concurrent && step.status != StepStatus.Failure) {
        resolve();
      }

      if (result && result.then instanceof Function && result.catch instanceof Function) {
        result.then(done).catch(err => step.failure(err));
      } else if (step.child) {
        this.execTasks(step.child).then(done);
      } else {
        done();
      }
    });
  }

  private generateState(options: { [key: string]: any }): IStepState {
    let index = process.argv.indexOf('--');
    let argv: minimist.ParsedArgs;

    if (index == -1) {
      argv = minimist([]);
    } else {
      argv = minimist(process.argv.slice(index + 1));
    }

    return {
      global: {
        argv: argv,
        get: (key: string) => this.stateValues[key],
        set: (key: string, value: any) => this.stateValues[key] = value,
      },
      current: {
        options: options,
        info: (message: string) => {
          this.getCurrentTask().info = message;
        },
        fail: (message?: string) => {
          this.getCurrentTask().failure(message);
        }
      }
    };
  }
}
